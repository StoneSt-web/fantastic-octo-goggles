// 渲染层：帧动画 + 鼠标拖动 + 点击穿透 + 节日气泡 + 闲置动画
//
// 版本演进（high-level）：
//   v1.1 基础打磨：气泡淡入/淡出、打字机、节日匹配、闲置 cooldown
//   v1.2 click 触发 hover（替代不可靠的 mouseenter/leave）
//   v1.3 系统托盘 + 退出菜单
//   v1.4 5 帧 (idle/blink/sing/sleep/wave) + sing 帧音符动画
//   v1.5 多皮肤 + 切换不 reload (eval frames-embed + mask 跟随当前帧)
//   v1.6 "笑一下" 用 onHide + 黑名单守卫实现 (smile 不被 sleep 拦截)
//   v1.7 阳光天使 halo 修复: halo-aware BFS 抠图 (中央透明)
//   v1.8 切皮肤 try/catch + tray-icon 校验 (避免 click handler 中断)
//
// 关键设计:
//   - 切皮肤不 reload: 主进程推送新 frames-embed.js, renderer eval 更新 FRAMES
//   - mask 跟随当前帧动态切换: 每个 PNG 自己当 hitArea 遮罩
//   - 状态机: idle/blink/sleep/sing/wave 五态互斥, 守卫用黑名单而非白名单
(function () {
  const hitArea = document.getElementById('hitArea');
  const pet = document.getElementById('pet');
  const body = document.body;

  // ============================================================
  //  节日表（可扩展）—— 通过公历月日范围匹配
  // ============================================================
  const FESTIVALS = [
    { key: 'dragon-boat', month: 6,  dayStart: 15, dayEnd: 25, label: '端午' },
    { key: 'mid-autumn',  month: 9,  dayStart: 15, dayEnd: 25, label: '中秋' },
    { key: 'spring',      month: 2,  dayStart: 1,  dayEnd: 15, label: '春节' },
    { key: 'new-year',    month: 1,  dayStart: 1,  dayEnd: 7,  label: '元旦' },
    { key: 'birthday',    month: 7,  dayStart: 5,  dayEnd: 5,  label: '生日' },
  ];

  // 时段 —— 影响 default 问候(不覆盖节日,节日有专属气泡)
const TIME_SLOTS = {
  dawn:  { start: 5,  end: 8  },   // 5-7 早安前夕
  morning: { start: 8,  end: 12 },  // 8-11 早安
  noon:  { start: 12, end: 14 },   // 12-13 午安
  afternoon: { start: 14, end: 18 }, // 14-17 下午
  evening: { start: 18, end: 23 }, // 18-22 晚安
  night: { start: 23, end: 29 },   // 23-4 深夜
};

function currentTimeSlot() {
  const h = new Date().getHours();
  for (const [k, v] of Object.entries(TIME_SLOTS)) {
    if (h >= v.start && h < v.end) return k;
  }
  return 'morning';
}

function currentFestival() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  for (const f of FESTIVALS) {
    if (f.month === m && d >= f.dayStart && d <= f.dayEnd) return f;
  }
  return null;
}

// 纪念日检查 —— 启动时弹 1 次
// 优先级: 用户纪念日 (advance=true 提前 1 天) > 节日
function checkAnniversaries() {
  if (!Array.isArray(window._anniversaries) || !window._anniversaries.length) return null;
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(d + 1);
  const tm = tomorrow.getMonth() + 1;
  const td = tomorrow.getDate();

  // 找今天匹配 + 明天匹配(advance)
  const today = window._anniversaries.find(a => a.month === m && a.day === d);
  if (today) return { label: today.label, advance: false };

  const advance = window._anniversaries.find(a => a.month === tm && a.day === td && a.advance !== false);
  if (advance) return { label: advance.label, advance: true };
  return null;
}

// ============================================================
//  宠物生日检查 —— v1.8 拟人化
//  返回招呼文本,或 null
// ============================================================
const BIRTHDAY_LINES_TODAY = [
  '今天是我的生日~ 🎂',
  '陪我过生日吧~',
  '今天最开心啦~',
  '🎂 生日快乐~ 给自己的',
  '又大一岁啦~ 陪我庆祝一下',
];
const BIRTHDAY_LINES_ADVANCE = [
  '明天是我的生日哦~ 🎂',
  '提前告诉~ 明天生日~',
  '诶嘿~ 明天是重要日子',
  '记得哦 明天要陪我过生日~',
];
const BIRTHDAY_LINES_ANNIV = (n, name) => [
  `和${name}一起 ${n} 年啦~`,
  `${n} 周年纪念~ ${name} 谢谢你~`,
  `今天是我们认识 ${n} 周年~`,
];

// 简单星座每日运势 —— v1.8
const ZODIAC_FORTUNE = {
  '白羊座': ['今天有冲劲,适合开新坑', '行动力满满,大胆一点', '能量爆棚,但别冲动'],
  '金牛座': ['稳扎稳打,今天会有小确幸', '享受当下,放慢节奏', '美食能治愈一切'],
  '双子座': ['好奇心旺盛,多学点新东西', '社交运好,多聊聊', '脑洞大开,记录灵感'],
  '巨蟹座': ['照顾好自己,情绪要表达', '家的温暖最治愈', '怀旧一下也很棒'],
  '狮子座': ['今天你是主角,大胆展示', '热情感染身边人', '自信一点,你能行'],
  '处女座': ['细节决定成败,认真一点', '整理一下桌面/代码', '完美主义适度就好'],
  '天秤座': ['今天需要做选择,听内心', '优雅应对一切', '平衡工作与休息'],
  '天蝎座': ['直觉很准,相信第一感', '深度思考时间,适合复盘', '别想太多,做就完了'],
  '射手座': ['冒险一下,自由在召唤', '出去走走,别宅', '乐观是你的超能力'],
  '摩羯座': ['今天的努力,未来会感谢', '专注一件事做透', '别太严肃,笑一笑'],
  '水瓶座': ['独特想法被认可,做自己', '科技/创新运好,试试新工具', '友善一点,会有意外收获'],
  '双鱼座': ['艺术灵感满满,记录下来', '温柔对待自己和他人', '梦境也许有暗示'],
};
function getDailyZodiacFortune(zodiac) {
  const arr = ZODIAC_FORTUNE[zodiac];
  if (!arr || !arr.length) return null;
  // 用日期作为种子,保证同一天同一个星座拿到的运势一致
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  let h = 0;
  for (let i = 0; i < zodiac.length; i++) h = (h * 31 + zodiac.charCodeAt(i)) | 0;
  const idx = Math.abs((seed ^ h) % arr.length);
  return arr[idx];
}

function checkPetBirthday() {
  const p = window._petProfile || {};
  const bd = p.birthday;
  if (!bd || !bd.month || !bd.day) return null;
  const name = (p.name || '').trim() || '我';
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();

  // 当天
  if (bd.month === m && bd.day === d) {
    // 周年纪念(有 birthdayAt 的话)
    if (p.birthdayAt) {
      const years = Math.floor((now.getTime() - p.birthdayAt) / (365.25 * 24 * 60 * 60 * 1000));
      if (years >= 1) {
        const lines = BIRTHDAY_LINES_ANNIV(years, name);
        return lines[Math.floor(Math.random() * lines.length)];
      }
    }
    return BIRTHDAY_LINES_TODAY[Math.floor(Math.random() * BIRTHDAY_LINES_TODAY.length)];
  }
  // 明天
  const tomorrow = new Date(now);
  tomorrow.setDate(d + 1);
  const tm = tomorrow.getMonth() + 1;
  const td = tomorrow.getDate();
  if (bd.month === tm && bd.day === td) {
    return BIRTHDAY_LINES_ADVANCE[Math.floor(Math.random() * BIRTHDAY_LINES_ADVANCE.length)];
  }
  return null;
}

const FESTIVAL_GREETINGS = {
    'dragon-boat': {
      '阳光天使':   ['端午安康~ 阳光配粽子~', '今天记得吃粽子哦', '粽叶飘香 陪着你'],
      '端午卜':     ['端午安康！', '今天记得吃粽子~', '粽叶飘香，祝你快乐', '端午大吉！', '想不想来一口粽子？', '咸的甜的都好吃~', '突然好想你 一起过端午'],
      'default':    ['端午安康~', '记得吃粽子~'],
    },
    'mid-autumn': {
      '阳光天使':   ['月亮好圆~ 给你一点光', '今晚月色好温柔', '一起赏月吧~'],
      '端午卜':     ['中秋快乐！', '月亮好圆~', '想和你一起赏月', '月饼想吃什么馅？', '今晚月色真美', '那一年我们望着星空'],
      'default':    ['中秋快乐~'],
    },
    'spring': {
      '阳光天使':   ['新年快乐~ 暖着走', '今年也要发光', '新春吉祥~'],
      '端午卜':     ['新年快乐！', '恭喜发财~', '新春大吉！', '红包在哪儿？', '今年也要元气满满！', '出走半生 归来仍少年'],
      'default':    ['新年快乐~'],
    },
    'new-year': {
      '阳光天使':   ['新的一年 暖着走~', '今年也要被照亮', '新年第一天~'],
      '端午卜':     ['新年第一天！', '今年也要加油~', '新的一年，冲！', '再不管你是谁 OAOA'],
      'default':    ['新的一年~'],
    },
    'birthday': {
      '阳光天使':   ['🎂 今天最暖的一天', '祝你被温柔照亮', '陪你过生日~'],
      '端午卜':     ['今天我生日！', '陪我过生日吧~', '要吃蛋糕！', '🎂 生日快乐~', '人生海海 活着就好'],
      'default':    ['🎂 生日快乐~'],
    },
    'default': {
      '阳光天使': {
        dawn:    ['天快亮了~ 再睡会儿吧', '陪你等日出'],
        morning: ['早上好~ 今天也要好好吃饭', '阳光正好~', '早安~ 给你一点光', '今天会顺利的~', '新的一天,加油', '我醒啦~ 在呢'],
        noon:    ['午安~ 休息一下', '吃了吗~', '中午要吃饱哦~'],
        afternoon: ['下午好~', '继续加油~', '要不要起来走走', '我在看着你哦~'],
        evening: ['晚上好~ 辛苦啦', '今天也累了吧', '晚上放松放松', '我给你照着~'],
        night:   ['还不睡呀~', '深夜了,记得早点休息', '陪你~'],
      },
      '端午卜': {
        dawn:    ['天快亮啦~', '快去睡吧'],
        morning: ['早上好~', '在呢~ 早安', '今天也要开心哦', '陪你~', '倔强一点~'],
        noon:    ['午安~', '吃饱没~', '咸鱼翻身~'],
        afternoon: ['下午好~', '嗨~', '继续加油'],
        evening: ['晚上好~ 累了吧', '今天辛苦啦', '突然好想你'],
        night:   ['还不睡呀~', '陪你~', '我不愿让你一个人'],
      },
      'default': {
        dawn:    ['天快亮了~'],
        morning: ['早上好~', '在呢~ 早安', '今天也要开心哦'],
        noon:    ['午安~', '在呢~', '陪你~'],
        afternoon: ['下午好~', '嗨~'],
        evening: ['晚上好~', '今天辛苦啦'],
        night:   ['还不睡呀~', '陪你~'],
      },
    },
  };

  // 过滤掉用户标 "不喜欢" 的气泡(score < 0)
  // 改进空间: 把 score 映射为权重(score>0 提高出现概率,score<0 降低)
  function filterByPreference(lines) {
    if (!Array.isArray(lines) || !window._bubbleRatings) return lines;
    return lines.filter(l => (window._bubbleRatings[l] || 0) >= 0);
  }

  function getGreeting() {
    const f = currentFestival();
    const fkey = f ? f.key : 'default';
    const skinId = window._activeSkinId || 'default';
    const table = FESTIVAL_GREETINGS[fkey] || FESTIVAL_GREETINGS.default;
    const linesOrTable = table[skinId] || table.default;
    // 节日用数组,default 用时段对象
    if (Array.isArray(linesOrTable)) return filterByPreference(linesOrTable);
    const slot = currentTimeSlot();
    return filterByPreference(linesOrTable[slot] || linesOrTable.morning);
  }

  // ============================================================
  //  互动等级: 0 = 静默, 高 = 越活跃, 影响眨眼频率
  //  声明提前,Bubble.show 内部需要调用
  // ============================================================
  let interactionLvl = 0;
  function bumpInteraction(amount = 1) {
    interactionLvl = Math.min(5, interactionLvl + amount);
  }
  setInterval(() => {
    if (interactionLvl > 0) interactionLvl = Math.max(0, interactionLvl - 0.05);
  }, 1000);

  // ============================================================
  //  自定义 prompt 模态框 —— 替代 window.prompt(Electron 透明窗口不支持)
  //  关键: 显示时关闭鼠标穿透(setIgnoreMouse(false)),关闭后恢复
  // ============================================================
  function customPrompt(question, defaultValue = '') {
    return new Promise((resolve) => {
      // 关闭穿透,让用户能点 modal
      if (window.petAPI && window.petAPI.setIgnoreMouse) {
        window.petAPI.setIgnoreMouse(false);
      }
      const wrap = document.createElement('div');
      wrap.className = 'pet-modal';
      wrap.innerHTML = `
        <div class="pet-modal-box">
          <div class="pet-modal-q">${question.replace(/</g, '&lt;')}</div>
          <input type="text" class="pet-modal-input" value="${defaultValue.replace(/"/g, '&quot;')}" />
          <div class="pet-modal-btns">
            <button class="pet-modal-cancel">取消</button>
            <button class="pet-modal-ok">确定</button>
          </div>
        </div>
      `;
      document.body.appendChild(wrap);
      const input = wrap.querySelector('.pet-modal-input');
      input.focus();
      input.select();

      const close = (val) => {
        if (wrap.parentNode) document.body.removeChild(wrap);
        // 恢复穿透
        if (window.petAPI && window.petAPI.setIgnoreMouse) {
          window.petAPI.setIgnoreMouse(true);
        }
        resolve(val);
      };
      wrap.querySelector('.pet-modal-ok').onclick = (e) => { e.stopPropagation(); close(input.value); };
      wrap.querySelector('.pet-modal-cancel').onclick = (e) => { e.stopPropagation(); close(null); };
      // 阻止 modal 区域事件冒泡到桌面
      wrap.addEventListener('mousedown', (e) => e.stopPropagation());
      wrap.addEventListener('click', (e) => e.stopPropagation());
      input.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') close(input.value);
        else if (e.key === 'Escape') close(null);
      };
    });
  }

  // ============================================================
  //  气泡模块 —— 单一全局 timer，避免竞态
  // ============================================================
  const Bubble = (() => {
    let el = null;
    let hideTimer = null;
    let typingTimer = null;
    let currentText = '';
    let pinnedText = '';   // 当前完整文本（typing 进行中也存这里）
    let onHide = null;     // 本次 show 调用注册的"气泡消失"回调（hide 完成时触发一次）
    let onHideToken = 0;   // 配对 token：每次 show 自增，确保新气泡触发的是最新回调

    function ensureEl() {
      if (el) return el;
      el = document.createElement('div');
      el.className = 'bubble';
      // 文字容器（用于打字机：保留文本宽度，但只显示部分字符）
      const textEl = document.createElement('span');
      textEl.className = 'bubble-text';
      el.appendChild(textEl);
      // 反馈按钮: ❤️ 喜欢 / ✕ 不喜欢 —— 用于学习用户偏好
      const fb = document.createElement('div');
      fb.className = 'bubble-fb';
      fb.innerHTML = '<button class="bubble-fb-like" title="喜欢">❤️</button><button class="bubble-fb-dislike" title="不喜欢">✕</button>';
      el.appendChild(fb);
      // 反馈按钮事件 —— 临时关穿透,处理完恢复
      const onFbClick = (e, isLike) => {
        e.stopPropagation();
        if (window.petAPI && window.petAPI.setIgnoreMouse) {
          window.petAPI.setIgnoreMouse(false);
        }
        if (window._onBubbleFeedback) window._onBubbleFeedback(pinnedText, isLike);
        // 视觉反馈
        const btn = e.currentTarget;
        btn.classList.add('clicked');
        setTimeout(() => {
          hide();
          // hide 后恢复穿透(因为我们为了按钮点击关了穿透)
          if (window.petAPI && window.petAPI.setIgnoreMouse) {
            window.petAPI.setIgnoreMouse(true);
          }
        }, 200);
      };
      fb.querySelector('.bubble-fb-like').onclick = (e) => onFbClick(e, true);
      fb.querySelector('.bubble-fb-dislike').onclick = (e) => onFbClick(e, false);
      // 防止 fb 区域触发 mousedown → drag
      fb.addEventListener('mousedown', (e) => e.stopPropagation());
      fb.addEventListener('click', (e) => e.stopPropagation());
      document.body.appendChild(el);
      return el;
    }

    function positionNow() {
      // 用 hitArea 作为定位锚点（原 petImg 已移除，5 个 frameImgs 叠在 hitArea 里）
      const rect = hitArea.getBoundingClientRect();
      el.style.left = (rect.right - 12) + 'px';
      el.style.top  = (rect.top + 10) + 'px';
    }

    function clearHideTimer() {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    }

    function clearTypingTimer() {
      if (typingTimer) {
        clearInterval(typingTimer);
        typingTimer = null;
      }
    }

    // 打字机：用 innerText 推字符
    function startTyping(fullText, perChar = 65) {
      clearTypingTimer();
      const textEl = el.querySelector('.bubble-text');
      textEl.textContent = '';
      let i = 0;
      typingTimer = setInterval(() => {
        i++;
        textEl.textContent = fullText.slice(0, i);
        if (i >= fullText.length) clearTypingTimer();
      }, perChar);
    }

    // 公共 API：显示文本
    //   - typing: true 打字机；false 直接显示
    //   - duration: 显示时长（ms）；0 = 不自动消失
    //   - typingSpeed: 打字机速度（ms/字，默认 65）
    //   - onHide: 气泡 hide 完成后回调一次（用于"先出气泡 → 气泡消失后切帧"）
    // 歌词识别：text 包含 "｜"（全角竖线） → 切到 sing 帧；hide 时切回 idle
    function show(text, opts = {}) {
      // typingSpeed 默认从 user pref 读(window._prefs.typingSpeed),
      // 允许调用方显式 override
      const defaultSpeed = (window._prefs && window._prefs.typingSpeed) || 65;
      // 默认 allowFeedback=false —— 只有五月天歌词库来源的句子才显示 ❤️/✕
      // (highlightOn 选到 mayday 句时显式传 true)
      // tts: true 自动朗读气泡(v1.11); false 不朗读; 'force' 强制朗读(忽略冷却)
      const { typing = true, duration = 2800, typingSpeed = defaultSpeed, onHide: cb, allowFeedback = false, tts = true } = opts;
      ensureEl();

      // 打断旧的：先关掉旧 hide/typing timer，但不立刻 hide 元素（避免抢动画）
      clearHideTimer();
      clearTypingTimer();

      // v1.11 TTS 朗读(开启时)
      if (tts && window._ttsSpeak) {
        const ttsPref = (window._prefs && window._prefs.tts) || {};
        const ttsEnabled = ttsPref.enabled !== false;  // 默认开启
        if (ttsEnabled) {
          window._ttsSpeak(text);
        }
      }

      // 注册本次 show 的 onHide 回调（用 token 配对，避免被后续 show 覆盖）
      onHide = typeof cb === 'function' ? cb : null;
      onHideToken++;

      // 互动统计:气泡显示
      if (window.petAPI && window.petAPI.stat) {
        window.petAPI.stat('bubble').catch(() => {});
      }
      // 眨眼互动:气泡出现 → 提高眨眼频率
      if (typeof bumpInteraction === 'function') bumpInteraction(2);
      // 升级检测
      if (typeof checkLevelUp === 'function') checkLevelUp();

      // 控制 ❤️/✕ 按钮是否显示
      const fb = el.querySelector('.bubble-fb');
      if (fb) fb.style.display = allowFeedback ? '' : 'none';

      currentText = text;
      window._currentBubbleText = text;  // 暴露给右键菜单"朗读这条"用
      pinnedText = text;

      // 如果当前已经在 show 状态，新文字直接替换（位置不动）
      const wasShown = el.classList.contains('show');
      positionNow();
      el.classList.remove('hide');

      if (!wasShown) {
        // 从隐藏态显示：先清掉 hide class，准备滑入
        // （CSS 默认状态已经是 opacity:0 + 偏移，show class 会触发 transition）
        // 强制重排，确保 transition 从初始状态开始
        void el.offsetWidth;
        el.classList.add('show');
      }

      // 歌词检测：含 "｜" 切到 sing 帧
      const isLyric = text && text.includes('｜');
      if (isLyric) {
        forceFrame('sing');
      }

      if (typing) {
        startTyping(text, typingSpeed);
      } else {
        const textEl = el.querySelector('.bubble-text');
        // 把 "｜" 替换成 <br> 实现两行显示
        // 我们的歌词语料是写死的，安全
        textEl.innerHTML = text.replace(/｜/g, '<br>');
      }

      if (duration > 0) {
        hideTimer = setTimeout(() => hide(), duration);
      }
    }

    function hide() {
      clearHideTimer();
      clearTypingTimer();
      if (!el || !el.classList.contains('show')) return;
      // 切到 hide class：CSS 会触发淡出动画
      el.classList.remove('show');
      el.classList.add('hide');
      // 取出本次 show 注册的回调（hide 触发过一次后清空，避免被后续误触）
      const cb = onHide;
      const token = onHideToken;
      onHide = null;
      // 动画结束后清空文本（避免下次显示残留）
      setTimeout(() => {
        if (el && el.classList.contains('hide')) {
          const textEl = el.querySelector('.bubble-text');
          if (textEl) textEl.textContent = '';
        }
        // 动画完成（约 220ms）后再触发 onHide
        // token 校验：本次 hide 期间没被新的 show 抢走
        if (cb && token === onHideToken) {
          try { cb(); } catch (e) { console.error('[Bubble] onHide error:', e); }
        }
      }, 220);
      // 气泡消失时同时清高亮 —— 但只在标记的"click 气泡"时才清
      if (window._onBubbleHide && window._bubbleFromClick) {
        window._onBubbleHide();
        window._bubbleFromClick = false;
      }
      // 气泡消失 → 切回 idle（如果当前是 sing 帧）
      // 排除 sleep 帧（睡觉不受气泡消失影响）
      if (currentFrame === 'sing') {
        forceFrame('idle');
      }
    }

    function followDrag() {
      // 拖动期间调用：实时更新位置
      if (el && el.classList.contains('show')) {
        positionNow();
      }
    }

    return { show, hide, followDrag, positionNow };
  })();

  // ============================================================
  //  帧管理：v1.8 预创建 5 个 <img>，切换时改 opacity (0 延迟)
  //  base64 嵌入字符串，浏览器启动时一次性预加载全部 5 张 PNG
  //  切换帧只改 opacity 0/1，瞬间完成（无异步加载等待）
  // ============================================================
  let FRAMES = window.PET_FRAMES || {};
  let currentFrame = 'idle';

  // 创建 5 个 <img>，叠在 hitArea 里，初始全部 opacity=0
  const frameImgs = {};
  const FRAME_NAMES = ['idle', 'blink', 'sleep', 'sing', 'wave'];
  for (const name of FRAME_NAMES) {
    const img = document.createElement('img');
    img.alt = '';
    // image-rendering: pixelated 减少浏览器抗锯齿（避免半透明灰点）
    img.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;object-position:center bottom;pointer-events:none;-webkit-user-drag:none;opacity:0;image-rendering:-webkit-optimize-contrast;image-rendering:pixelated;';
    if (FRAMES[name]) {
      img.src = FRAMES[name];
    }
    hitArea.appendChild(img);
    frameImgs[name] = img;
  }

  // 删除原 HTML 里的 <img id="petImg">（避免双层）
  const petImg = document.getElementById('petImg');
  if (petImg && petImg.parentNode) {
    petImg.parentNode.removeChild(petImg);
  }

  // 初始: idle 帧可见（但要等图片加载完再显示，避免 alt）
  function showInitial() {
    if (frameImgs.idle && frameImgs.idle.complete && frameImgs.idle.naturalWidth > 0) {
      frameImgs.idle.style.opacity = '1';
    } else if (frameImgs.idle) {
      frameImgs.idle.onload = () => {
        frameImgs.idle.style.opacity = '1';
      };
    }
  }
  showInitial();

  // 注: v1.7 之前用 PNG 当 mask 限制鼠标命中区,但 pet.png alpha 抠图后有些半透明,
  // 切到 sleep 等帧时透明位置会"缺角"。现已改用 hitArea 整个矩形接收事件,
  // 不再需要 updateMask 函数（保留调用点已经全部清理）

  function switchFrame(name) {
    if (!FRAMES[name] || name === currentFrame) return;
    // 隐藏当前帧，显示新帧（瞬间完成，不需要重新加载）
    if (frameImgs[currentFrame]) frameImgs[currentFrame].style.opacity = '0';
    if (frameImgs[name]) frameImgs[name].style.opacity = '1';
    currentFrame = name;
  }

  function forceFrame(name) {
    if (!FRAMES[name]) return;
    if (frameImgs[currentFrame]) frameImgs[currentFrame].style.opacity = '0';
    if (frameImgs[name]) frameImgs[name].style.opacity = '1';
    currentFrame = name;
  }

  function blink(durationMs = 280) {
    // 睡觉时禁止眨眼 —— 保持闭眼状态
    if (currentFrame === 'sleep') return;
    switchFrame('blink');
    setTimeout(() => {
      // 醒来过程中可能切到 idle 了，不要强制切回 blink
      if (currentFrame === 'blink') switchFrame('idle');
    }, durationMs);
  }

  // ============================================================
  //  等级/称号系统 —— 基于互动量
  // ============================================================
  const LEVELS = [
    { min: 0,     title: '初识',     desc: '我们刚开始认识~' },
    { min: 20,    title: '新朋友',   desc: '聊了几句话~' },
    { min: 80,    title: '老友',     desc: '已经熟起来了' },
    { min: 200,   title: '挚友',     desc: '每天都想见到你' },
    { min: 500,   title: '羁绊',     desc: '已经是家人了' },
    { min: 1200,  title: '不弃',     desc: '说好的不离开' },
    { min: 3000,  title: '永远',     desc: '陪你走过的每一刻' },
  ];

  function totalInteraction() {
    if (!window._stats) return 0;
    const s = window._stats;
    return (s.totalClicks || 0) + (s.totalDrags || 0) + (s.totalBubbles || 0);
  }

  function currentLevel() {
    const t = totalInteraction();
    let lvl = LEVELS[0];
    for (const l of LEVELS) {
      if (t >= l.min) lvl = l;
    }
    return { ...lvl, total: t };
  }

  function nextLevel() {
    const cur = currentLevel();
    const idx = LEVELS.indexOf(LEVELS.find(l => l.min === cur.min));
    if (idx < LEVELS.length - 1) return { ...LEVELS[idx + 1], current: cur };
    return null;  // 已满级
  }

  // 升级检测:每次 Bubble.show 前调用,等级变化时弹气泡庆祝
  let _lastLevel = null;
  function checkLevelUp() {
    if (!window._stats) return;
    const cur = currentLevel();
    if (_lastLevel === null) {
      _lastLevel = cur.min;
      return;
    }
    if (cur.min > _lastLevel) {
      _lastLevel = cur.min;
      const next = nextLevel();
      const msg = `✨ 升级！现在是「${cur.title}」 ${cur.desc}`
        + (next ? `\n距离「${next.title}」还差 ${next.min - cur.total} 次互动` : '已达满级！');
      // 延迟到当前气泡消失再显示
      setTimeout(() => Bubble.show(msg, { typing: true, duration: 4500 }), 100);
    }
  }

  // 呼吸动画: rAF 持续微调 transform scale(0.97 ↔ 1.0), 周期 3.2s
  // 注意: 不能用 CSS animation, 因为 .pet 上的 .shake/.walk 等动画会冲突覆盖。
  // JS 直接改 inline style, CSS transition 0.6s 让变化平滑
  // 重要: 如果当前 .pet 上有 CSS 动画类(.shake/.walk/.bye/.wave/.nod),
  //       跳过呼吸,避免和 CSS animation 抢 transform
  const ANIMATION_CLASSES = new Set(['shake', 'shrink', 'walk', 'nod', 'wave', 'bye']);
  let breatheStart = 0;
  function breatheTick(ts) {
    if (!breatheStart) breatheStart = ts;
    const elapsed = (ts - breatheStart) / 1000;
    // 检查当前 .pet 是否在 CSS 动画中
    const hasCSSAnim = Array.from(pet.classList).some(c => ANIMATION_CLASSES.has(c));
    if (hasCSSAnim) {
      // CSS animation 期间:让出 transform,等动画结束(transition 0.6s 会平滑回到无 transform)
      pet.style.transform = '';
    } else {
      // 振幅: idle 0.97-1.0, hover 0.95-1.02, sleep 0.95-0.98
      // v1.10: 凑近 / 歪头 时跳过 breathe(CSS class 控制 transform)
      const hasApproachOrTilt = document.body.classList.contains('approach-left')
        || document.body.classList.contains('approach-right')
        || document.body.classList.contains('tilt');
      if (hasApproachOrTilt) {
        pet.style.transform = '';  // 让 CSS class 接管
      } else {
        let amp = 0.015;
        let offset = 0.985;
        let period = 3.2;
        if (isSleeping) {
          amp = 0.015; offset = 0.965; period = 2.4;
        } else if (isHighlighted) {
          amp = 0.035; offset = 0.985; period = 2.0;
        }
        const phase = (elapsed / period) * Math.PI * 2;
        const scale = offset + amp + amp * Math.sin(phase);
        pet.style.transform = `scale(${scale.toFixed(4)})`;
      }
    }
    requestAnimationFrame(breatheTick);
  }
  requestAnimationFrame(breatheTick);

  // 随机眨眼:基础间隔 5~10s,但互动活跃时(气泡/点击/拖动后)概率高
  // 互动等级 0 → 间隔 5-10s; 等级 5 → 间隔 1.5-3s
  function scheduleBlink() {
    const baseMin = 5000 - interactionLvl * 700;   // 5→1.5
    const baseMax = 10000 - interactionLvl * 1400;  // 10→3
    const delay = baseMin + Math.random() * (baseMax - baseMin);
    setTimeout(() => {
      blink(280);
      scheduleBlink();
    }, delay);
  }
  scheduleBlink();

  // ============================================================
  //  闲置动画 + 自动睡觉 —— 加 cooldown，气泡期间不打扰
  //  3 分钟无交互 → 自动睡觉 → 直到下次交互才醒来
  // ============================================================
  // 闲置触发间隔 —— 从 user pref 读 bubbleFrequency
  //  - low    → 60s
  //  - normal → 30s
  //  - high   → 15s
  // 默认 30s(prefs 加载前)
  const IDLE_THRESHOLD_DEFAULT = 30 * 1000;
  const SLEEP_THRESHOLD = 3 * 60 * 1000;  // 3 分钟无交互进入睡眠
  function getIdleThreshold() {
    const f = window._prefs && window._prefs.bubbleFrequency;
    if (f === 'low') return 60 * 1000;
    if (f === 'high') return 15 * 1000;
    return IDLE_THRESHOLD_DEFAULT;  // normal / undefined
  }
  // 暴露到 window 供 debug
  window._getIdleThreshold = getIdleThreshold;
  const IDLE_BUBBLES = [
    '有点无聊呢~', '在发呆中...', '嗯？',
    '陪我玩一会儿？', '今天也很安静呀',
  ];
  let idleTimer = null;
  let sleepTimer = null;
  let isSleeping = false;  // 当前是否处于睡眠状态
  let lastActivity = Date.now();

  function resetIdleTimer() {
    lastActivity = Date.now();
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    if (sleepTimer) { clearTimeout(sleepTimer); sleepTimer = null; }
    // 如果正在睡眠，用户交互会先唤醒，然后继续计时
    if (isSleeping) {
      wakeUp();
    }
    // 排下一次闲置动画 —— 用当前 pref 的间隔(pref 切换时下次 resetIdleTimer 会自动应用)
    idleTimer = setTimeout(triggerIdleAnimation, getIdleThreshold());
    // 排睡眠倒计时
    sleepTimer = setTimeout(triggerSleep, SLEEP_THRESHOLD);
  }

  function triggerIdleAnimation() {
    if (isSleeping) return;  // 睡着时不触发闲置动画
    // 守卫：smile 期间（currentFrame='blink' 且正在显示气泡）跳过闲置动画
    // 否则闲置动画会破坏"笑"的视觉状态
    if (currentFrame === 'blink') {
      // 延后重排（不立刻递归，等下次 resetIdleTimer 再启）
      idleTimer = setTimeout(triggerIdleAnimation, getIdleThreshold());
      return;
    }
    const actions = ['shake', 'shrink', 'walk'];
    const action = actions[Math.floor(Math.random() * actions.length)];
    pet.classList.remove('shake', 'shrink', 'walk');
    void pet.offsetWidth;
    pet.classList.add(action);
    Bubble.show(idleSay(IDLE_BUBBLES[Math.floor(Math.random() * IDLE_BUBBLES.length)]));
    setTimeout(() => {
      pet.classList.remove(action);
      // cooldown：等动画结束 + 气泡显示完再排下一轮
      if (!isSleeping) {
        idleTimer = setTimeout(triggerIdleAnimation, getIdleThreshold());
      }
    }, 2200);
  }

  // 3 分钟无交互 → 切到睡眠
  function triggerSleep() {
    if (isSleeping) return;
    isSleeping = true;
    // 清理闲置动画 class
    pet.classList.remove('shake', 'shrink', 'walk', 'nod', 'wave', 'bye');
    // 切到 sleep 帧
    forceFrame('sleep');
    pet.classList.add('sleep');
    addZzz();
    // 清理闲置 timer
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  }

  // 任何用户交互 → 唤醒
  function wakeUp() {
    if (!isSleeping) return;
    isSleeping = false;
    pet.classList.remove('sleep');
    forceFrame('idle');
    removeZzz();
    // 醒来瞬间眨一下眼
    setTimeout(() => blink(280), 100);
  }

  ['mousedown', 'mousemove', 'keydown', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();

  // ============================================================
  //  鼠标交互 —— 拖动 + 气泡跟随
  // ============================================================
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let dragRAF = null;
  let _lastDodgeAt = 0;  // 上次 dodge 时间 —— 1.5s 冷却
  let _dodgeTimer = null;  // 切回 idle 的 timer —— 新 dodge 时清掉旧的
  
  const DRAG_BUBBLES = [
    '拖我去哪里呀？', '好啦好啦~', '哎呀轻点~',
    '跟着你走~', '这边这边！', '我也想去！',
  ];

  // ============================================================
  //  Click 高亮 —— 单击角色 → 高亮 + 气泡，再次单击或菜单关闭 → 高亮消失
  //  设计变更：放弃 hover 触发，改为 click 触发 —— 完全规避 mouseenter/mouseleave 漏触发
  //
  //  气泡语料 —— 五月天金句 + 节日/日常/状态文案
  //  气泡最大宽度 165px（CSS），按 13px/字 估算约 6-12 字合适
  //  来源：阿信作词的五月天经典歌词精炼
  // ============================================================

  // Zzz 元素：附加到 hitArea 内（角色右上角），sleep 时显示，醒时移除
  let zzzEl = null;
  function addZzz() {
    if (zzzEl) return;
    zzzEl = document.createElement('div');
    zzzEl.className = 'zzz';
    zzzEl.innerHTML = '<span>z</span><span>z</span><span>z</span><span>Z</span>';
    hitArea.appendChild(zzzEl);
  }
  function removeZzz() {
    if (!zzzEl) return;
    zzzEl.remove();
    zzzEl = null;
  }
  // 气泡语料库
//   "｜" (全角竖线) 是换行符 —— Bubble.show 把 "｜" 替换成 <br>
const HOVER_BUBBLES = {
    'dragon-boat': [
      '嗯？找我？', '戳我干嘛~', '想我了？',
      '摸摸头~', '要我陪你？', '粽叶飘香~',
      '龙舟划过心湖~', '咸的甜的都好吃~',
    ],
    'mid-autumn': [
      '月亮好圆~', '想和你赏月~', '月光洒进回忆',
      '我心中尚未崩坏的地方', '温柔地想你',
    ],
    'spring': [
      '恭喜发财~', '红包在哪儿？', '新年好呀~',
      '出走半生 归来仍少年', '人生海海',
    ],
    'new-year': [
      '新年第一天！', '今年也要加油~',
      '出走半生 归来仍少年',
    ],
    'birthday': [
      '今天我生日！', '陪我过生日吧~',
      '生日快乐~ 🎂',
    ],
    // 五月天金句 —— 来自《倔强》《突然好想你》《知足》《温柔》《干杯》《OAOA》《星空》《如烟》等
    // 用 "｜" 分隔相邻两句，模拟歌词跨行感
    'mayday': [
      // 倔强
      '我不怕千万人阻挡｜只怕自己投降',
      '最美的愿望 一定最疯狂｜我就是我自己的神',
      '逆风的方向 更适合飞翔｜握紧双手绝对不放',
      '爱我的人别紧张｜我的固执很善良',
      '你说被火烧过｜才能出现凤凰',
      // 突然好想你
      '最怕空气突然安静｜最怕朋友突然的关心',
      '突然好想你 你会在哪里｜过的快乐或委屈',
      '突然锋利的回忆｜突然模糊的眼睛',
      '我们像一首最美丽的歌曲｜变成两部悲伤的电影',
      '那麽甜 那麽美 那麽相信｜那麽疯 那麽热烈的曾经',
      // 知足
      '怎么去拥有一道彩虹｜怎么去拥抱一夏天的风',
      '如果你快乐不是为我｜会不会放手 其实才是拥有',
      '终于你身影消失在人海尽头｜才发现笑着哭最痛',
      '如果我爱上你的笑容｜要怎么收藏 要怎么拥有',
      // 温柔
      '不打扰 是我的温柔｜你的微笑 是我担心的所有',
      '没有关系 你的世界｜才能让我安心的流泪',
      // 干杯
      '会不会有一天 时间真的能倒退｜退回 你的我的 回不去的悠悠岁月',
      '和你再干一杯｜再干一杯永远',
      '有一天 就是今天｜说出一直没说 对你的感谢',
      // OAOA / 离开地球表面
      '别想 别怕 别后退｜现在 就是 永远',
      '去疯 去爱 去浪费｜和我再唱OAOA',
      '人生都太短暂｜出发的 那一天',
      // 星空
      '那一年我们望着星空｜有那麽多的灿烂的梦',
      '像不变星空 陪着我｜像不变回忆 陪着我',
      '细数繁星闪烁｜细数此生奔波',
      // 如烟
      '生命是华丽错觉｜时间是贼 偷走一切',
      '拥抱过的美丽 都再也不破碎｜让险峻岁月不能在脸上撒野',
      '有没有那麽一滴眼泪｜能洗掉后悔',
      // 我不愿让你一个人
      '我不愿让你一个人｜一个人在人海浮沉',
      '我不愿让你一个人｜承受这世界的残忍',
      '只求你有快乐人生｜只求命运 带你去一段全新的旅程',
      // 第二人生
      '生命不是过程 而是美丽旅程｜风景有亮和暗 也有爱和恨',
      '第一站叫天真｜第二站叫青春',
      // 任意门 / 成名在望
      '任意门通向未来｜成名在望 不怕挫败',
      // 入阵曲
      '入阵曲 伴我无悔的狂妄｜忘不记 原不谅 愤恨无疆',
      // 拥抱
      '拥抱 是最温暖的承诺｜脱下长日的假面',
      // 终结孤单
      '我心中尚未崩坏的地方｜只要有你在 就什么都不怕',
      // 步步
      '如果人生没有回头路｜我愿意 付出任何代价',
      // 人生海海
      '人生海海 活着就好｜甘愿 人生海海',
      // 咸鱼
      '我是一只咸鱼｜也想游向大海',
      // 憨人
      '不甘心的人生 才算精彩｜你甘愿 当一个憨人',
      // 盛夏光年
      '盛夏光年 终于｜听见 那一年',
      // 后青春期的诗
      '后青春期的诗｜写到现在 终于让自己属于我自己',
      // 突然好想见到你
      '突然好想见到你｜听见了吗 我在这里等你',
      // 听不到
      '我愿意付出 我愿意付出｜所有 换一句 听不到',
      // 爱情万岁
      '爱情万岁 爱情万岁｜如果这样算快乐',
      // 反而（来自《时光机》）
      '看的清楚 反而朦胧｜越是了解 反而越是惶恐',
      '想要执著 反而磋跎｜越是等候 反而越是错过',
      '保持沉默 反而脆弱｜越是忍耐 反而越是汹涌',
      // 候鸟
      '我的故事 被风吹散｜我的明天 我从不期待',
      '现在 我只想要｜寻找一丝 最后的温暖',
      // 你不是真正的快乐
      '为什么失去了｜还要被惩罚呢',
      '这世界笑了｜于是你合群的一起笑了',
      '你不是真正的快乐｜你的笑只是你穿的保护色',
      // 我心中尚未崩坏的地方
      '其实我们都一模一样｜无名却充满了莫名渴望',
      '一生等一次 发光｜我心中尚未崩坏的地方',
      // 后来的我们
      '后来的我们｜什么都有了｜却没有了我们',
      '后来 我总算学会了｜如何去爱',
      // 玫瑰少年
      '生而为人无罪｜你不需要抱歉',
      '哪朵玫瑰 没有荆棘｜最好的 报复是 美丽',
      // 笑忘歌
      '昨天太近 明天太远｜今天 哭也笑得灿烂',
      '如果世界太危险｜只有音乐最安全',
      // 派对动物
      '派对动物 别再自我拉扯｜派对动物 一起摇摆',
      // 如果我们不曾相遇
      '如果我们不曾相遇｜我会是在哪里',
      '我们如果不别离｜是不是就不算辜负',
      // 任意门
      '任意门 通向未来｜任意门 通向自由',
      // 第一天
      '第一天 我存在｜第一次呼吸畅快',
      // 孙悟空
      '如果要让我活｜让我有梦活',
      // 终结孤单
      '想走出你控制的领域｜却走进另一个迷宫',
      // 温柔（不打扰版）
      '没有关系 你的世界｜就让你拥有',
      '不打扰 是我最后的温柔',
      // 而我知道
      '而我知道｜那一段 青春 不只是路过',
      // 因为你 所以我
      '因为你 所以我｜让我成为 我',
    ],
    'default': [
      // 日常问候 + 五月天短句
      '你好呀~｜陪着你呢',
      '在想什么呢？｜嗨~',
      '今天也要开心哦｜嘿嘿~',
      '在呢~｜我在这儿呢',
      '要不要听首歌？｜陪你聊聊？',
      '倔强一点~｜知足一点~',
      '温柔一点~｜握紧双手不放',
      '人生海海｜去疯去爱去浪费',
      '陪你到永远｜我不愿让你一个人',
    ],
    'classical': [
      // 古风金句 —— 山川明月 / 诗词意境
      '愿与君共｜山河远阔',
      '山有木兮｜木有枝',
      '心悦君兮｜君不知',
      '月落乌啼｜霜满天',
      '江畔何人初见月',
      '春风十里｜不如你',
      '浮生若梦｜为欢几何',
      '人生若只如初见',
      '何事长向别时圆',
      '愿我如星君如月',
      '夜夜流光｜相皎洁',
      '此心安处｜是吾乡',
      '长风破浪｜会有时',
      '直挂云帆｜济沧海',
    ],
  };

  // "五月天歌词"白名单 —— 只对这些句子显示 ❤️/✕ 学习反馈按钮
  // 其他来源(customLines / 节日 / default / classical / 系统消息)都不显示
  const MAYDAY_LINES_SET = new Set(HOVER_BUBBLES.mayday || []);

  let isHighlighted = false;  // 高亮状态 —— click 切换

  // 注册气泡消失回调 —— click 气泡消失时自动清高亮
  window._onBubbleHide = () => {
    if (isHighlighted) highlightOff();
  };

  // 抽取: 从金句池选随机句子
  // opts.excludeLyrics=true 时排除歌词(带 ｜)
  // opts.allowLyrics=true 时只选歌词
  // 默认: 包括歌词(右键"唱歌"用)
  function pickRandomLine(opts = {}) {
    let lines = [];
    // 用户自定义金句(优先)
    if (Array.isArray(window._customLines) && window._customLines.length) {
      lines.push(...window._customLines);
    }
    // 当前主题词库(用户偏好) —— mayday / default / classical
    const themeKey = (window._prefs && window._prefs.theme) || 'mayday';
    if (HOVER_BUBBLES[themeKey]) {
      lines.push(...HOVER_BUBBLES[themeKey]);
    } else if (HOVER_BUBBLES.mayday) {
      lines.push(...HOVER_BUBBLES.mayday);
    }
    // 节日额外加几条节日金句
    const f = currentFestival();
    if (f && HOVER_BUBBLES[f.key]) {
      lines.push(...HOVER_BUBBLES[f.key]);
    }
    // 兜底：日常(常驻)
    if (HOVER_BUBBLES.default) {
      lines.push(...HOVER_BUBBLES.default);
    }
    // 过滤不喜欢的气泡
    lines = filterByPreference(lines);
    // 根据 opts 过滤
    if (opts.excludeLyrics) {
      lines = lines.filter(l => !l || !l.includes('｜'));
    } else if (opts.allowLyrics) {
      lines = lines.filter(l => l && l.includes('｜'));
    }
    if (!lines.length) return null;
    return lines[Math.floor(Math.random() * lines.length)];
  }

  // 显示一首歌(随机歌词 + sing 帧)
  // v1.11.4: 从右键菜单"🎤 让它唱首歌"调
  function showSingingBubble() {
    const text = pickRandomLine({ allowLyrics: true });
    if (!text) {
      // 没歌词可唱,显示金句兜底
      return highlightOn();
    }
    isHighlighted = true;
    pet.classList.add('hovering');
    window._bubbleFromClick = true;
    // 歌词 → Bubble.show 内部会自动切到 sing 帧
    // 不用手动切
    const isFromMayday = MAYDAY_LINES_SET.has(text);
    const scale = (window._prefs && window._prefs.petScale) || 1.0;
    const allowFeedback = isFromMayday && scale >= 0.9;
    // tts: false 关闭 Bubble.show 默认朗读(它只读第一行)
    // 然后自己调 speakBubble(text, { fullText: true }) 读完整歌词
    Bubble.show(text, { typing: false, duration: 5000, allowFeedback, tts: false });
    // 单独调完整朗读
    if (window._ttsSpeak) {
      // 等 250ms 避开 Bubble.show 的 TTS(我们关了,但避免竞态)
      setTimeout(() => {
        window._ttsSpeak(text, { fullText: true });
      }, 250);
    }
  }

  // 高亮切换(不带金句) —— v1.11.4 click 路径专用
  // 只切 hovering class, 不显示气泡
  // click 路径直接调这个 + dodge,不调 highlightOn
  function highlightOn() {
    isHighlighted = true;
    pet.classList.add('hovering');
  }

  function highlightOff() {
    isHighlighted = false;
    pet.classList.remove('hovering');
    Bubble.hide();
  }

  // 鼠标进入 hitArea —— 关穿透 + 允许 mousedown
  function enterPet() {
    if (!dragging) {
      window.petAPI.setIgnoreMouse(false);
    }
    // 注意：这里不加 hovering class —— 高亮由 click 触发
  }

  // 鼠标离开 hitArea —— 不调 setIgnoreMouse(true)
  // 关键：保持穿透=false，让 mousedown 还能继续工作
  // 真正的"恢复穿透"在 mouseup 时做
  function leavePet() {
    // 不调 setIgnoreMouse(true) —— 否则 mousedown 收不到
    // 不调 highlightOff —— 高亮由 click 切换，不由 hover 切换
  }

  hitArea.addEventListener('mouseenter', enterPet);
  hitArea.addEventListener('mouseleave', leavePet);

  // 单击切换高亮（在 click handler 里调用，但 mousedown 会阻止 click，所以分开绑定）
  // 这里用 mousedown 的"非拖动"判定代替 click —— mouseup 时检查有没有移动过
  let mousedownX = 0;
  let mousedownY = 0;
  let mousedownAt = 0;

  hitArea.addEventListener('mousedown', (e) => {
    dragging = true;
    body.classList.add('dragging');
    // 直接强制设 cursor —— 防止 class 不生效
    document.body.style.cursor = 'grabbing';
    hitArea.style.cursor = 'grabbing';
    startX = e.screenX;
    startY = e.screenY;
    // 记录 mousedown 位置和时间，用于 mouseup 判定是否是 click
    mousedownX = e.screenX;
    mousedownY = e.screenY;
    mousedownAt = Date.now();
    e.preventDefault();
    e.stopPropagation();
    // 拖动期间关闭穿透，让 mousemove 能持续触发（不调会卡住）
    window.petAPI.setIgnoreMouse(false);
    // 不在这里显示拖动气泡 —— 等 mouseup 时根据是否移动判定显示 drag 还是 click 气泡
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dx = e.screenX - startX;
    const dy = e.screenY - startY;
    startX = e.screenX;
    startY = e.screenY;
    window.petAPI.move(dx, dy);

    // 拖动期间：每帧更新气泡位置（rAF 节流，避免高频 DOM 操作）
    if (!dragRAF) {
      dragRAF = requestAnimationFrame(() => {
        Bubble.followDrag();
        dragRAF = null;
      });
    }
  });

  // 累计拖动距离(全局 session 级)
  let totalDragDist = 0;

  // 飘爱心: 在指定位置产生一颗向上飘的爱心,1.6s 消失
  // 多次连点会生成多颗(随机水平偏移)
  function spawnHeart(x, y) {
    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    const offsetX = (Math.random() - 0.5) * 40;  // -20~+20px 随机
    heart.style.left = (x + offsetX) + 'px';
    heart.style.top = y + 'px';
    heart.textContent = ['❤️', '💕', '💖', '💝'][Math.floor(Math.random() * 4)];
    document.body.appendChild(heart);
    setTimeout(() => {
      if (heart.parentNode) heart.remove();
    }, 1700);
  }

  // 暴露给 menu action 触发
  window.spawnHeart = spawnHeart;
  // 暴露桌宠当前位置(从 hitArea 中心)
  window.spawnHeartAtPet = () => {
    const r = hitArea.getBoundingClientRect();
    spawnHeart(r.left + r.width / 2, r.top + r.height / 2);
  };

  window.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;
    body.classList.remove('dragging');
    // 恢复 cursor —— 即使 class 不生效，inline style 也要清
    document.body.style.cursor = '';
    hitArea.style.cursor = '';
    window.petAPI.setIgnoreMouse(true);

    // 判定是 click 还是 drag：移动距离 < 5px 且时间 < 300ms 视为 click
    const dx = Math.abs(e.screenX - mousedownX);
    const dy = Math.abs(e.screenY - mousedownY);
    const dt = Date.now() - mousedownAt;
    const isClick = dx < 5 && dy < 5 && dt < 300;

    if (isClick) {
      // v1.11.4: click 路径只做 dodge,不再 toggle 高亮 / 显示金句
      // 唱歌功能封装到右键菜单"🎤 让它唱首歌"
      window.petAPI.stat('click').catch(() => {});
      bumpInteraction(1);  // 点击也提高眨眼频率
      // 单击也飘 1 颗爱心(给点反馈)
      if (window.spawnHeartAtPet) window.spawnHeartAtPet();
      // 桌宠躲避(被点到了就跳开)—— 1.5s 冷却避免连续触发太烦
      if (window.petAPI && window.petAPI.dodge && Date.now() - _lastDodgeAt > 1500) {
        _lastDodgeAt = Date.now();
        window.petAPI.dodge().catch(() => {});
        // 触发"惊讶"表情
        if (currentFrame !== 'sleep') {
          // 清掉上次的切回 idle timer(避免快速点击时 wave 被旧 timer 提前切走)
          if (_dodgeTimer) {
            clearTimeout(_dodgeTimer);
            _dodgeTimer = null;
          }
          switchFrame('wave');  // 用 wave 帧代替 surprised(v1.4 决策搁置)
          _dodgeTimer = setTimeout(() => {
            _dodgeTimer = null;
            if (currentFrame === 'wave') switchFrame('idle');
          }, 1500);
          // 躲避气泡: 调皮可爱风
          const dodgeLines = [
            '哎哟!',
            '别戳我~',
            '啊!吓到啦!',
            '别动手!',
            '跑~',
            '溜了溜了~',
            '戳我干嘛~',
            '疼!',
            '哎哎哎轻点~',
            '我躲!',
          ];
          const txt = dodgeLines[Math.floor(Math.random() * dodgeLines.length)];
          // 直接 show dodge 气泡(不需要先 hide 旧 hover 气泡,因为没有 hover 气泡了)
          Bubble.show(txt, {
            typing: true,
            duration: 1800,
            onHide: () => {
              // dodge 气泡消失时清高亮(以防右键"唱歌"残留)
              if (isHighlighted) highlightOff();
            },
          });
          // 标记为 click 触发 —— 让 onHide 知道这是"需要清高亮"的气泡
          window._bubbleFromClick = true;
        }
      }
    } else {
      // 拖动结束：清高亮 + 显示反馈气泡
      if (isHighlighted) highlightOff();
      window.petAPI.stat('drag').catch(() => {});

      // 累计距离
      const dragDist = Math.round(Math.hypot(dx, dy));
      totalDragDist += dragDist;

      // 拖动反馈: 根据距离显示不同气泡 + 累计里程碑
      const lines = [];
      if (dragDist < 30) {
        lines.push('哎呀轻点~', '好啦好啦~', '在这边~');
      } else if (dragDist < 100) {
        lines.push('拖我去哪里呀~', '跟着你走~', '这边这边!');
      } else if (dragDist < 300) {
        lines.push('好刺激~', '我也想去!', '抓住啦~');
      } else {
        lines.push('飞起来啦!', '跨越了大半个屏幕~', '跑酷模式!');
      }
      // 累计里程碑
      if (totalDragDist > 1000 && totalDragDist % 1000 < dragDist) {
        lines.push(`我们一起走了 ${totalDragDist}px 啦~`);
      }
      Bubble.show(lines[Math.floor(Math.random() * lines.length)]);
    }
  });

// ============================================================
//  交互：右键菜单
// ============================================================
// click 判定在 mouseup 里通过移动距离判断(避免 mousedown 阻止 click 事件)

hitArea.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    window.petAPI.showMenu(e.screenX, e.screenY);
  });

  // ============================================================
  //  鼠标互动 v1.10: 凑近 + 歪头 + 躲避
  // ============================================================
  //  主进程轮询鼠标位置,通过 IPC 推送:
  //   - pet:approach { dir, distance }   鼠标在桌宠 100px 内 → 桌宠朝 dir 偏转
  //   - pet:near-tilt                    鼠标 80-180px 范围 + 50% 概率 → 歪头 1.2s
  //   - pet:hover / pet:hover-leave      hover 状态(主进程兜底,这里是主路径)
  //  命中 hitArea click → 调 petAPI.dodge() 让桌宠跳开

  // 凑近: 在 .pet 上加 transform 偏移
  // 注意: 已经有 breathe (rAF) 在改 .pet.style.transform
  // 这里用单独的 inline style 属性 'data-approach-dir'
  // breathe transform 里读取这个属性 + 合成
  // 简化: 用 CSS class 切换 + transform
  if (window.petAPI && window.petAPI.onApproach) {
    window.petAPI.onApproach((data) => {
      if (!data || !data.dir) {
        document.body.classList.remove('approach-left', 'approach-right');
      } else {
        document.body.classList.remove('approach-left', 'approach-right');
        document.body.classList.add('approach-' + data.dir);
      }
    });
  }

  // 歪头: 临时加 tilt class,1.2s 后自动移除
  if (window.petAPI && window.petAPI.onNearTilt) {
    window.petAPI.onNearTilt(() => {
      if (document.body.classList.contains('tilt')) return;  // 已经在歪头
      document.body.classList.add('tilt');
      setTimeout(() => {
        document.body.classList.remove('tilt');
      }, 1200);
    });
  }

  // 主进程兜底的 hover 事件(主路径是 renderer mouseenter/leave)
  if (window.petAPI && window.petAPI.onPetHover) {
    window.petAPI.onPetHover(() => {
      // 不重复触发 hover 高亮(mouseenter 已做),这里只 reset 闲置 timer
      resetIdleTimer();
    });
  }

  // 菜单动作
  window.petAPI.onMenuAction(async (action) => {
    // 任何菜单动作都视为用户交互 → 重置闲置 + 睡眠 timer
    // (菜单 sleep 内部会清掉 timer，所以这里会被覆盖)
    if (action !== 'sleep') {
      resetIdleTimer();
    }
    if (action === 'greet') {
      // 打个招呼：挥手/点头 + 节日问候气泡
      pet.classList.remove('wave', 'nod', 'bye', 'sleep');
      void pet.offsetWidth;
      pet.classList.add(Math.random() < 0.5 ? 'wave' : 'nod');
      // 切到 wave PNG 帧（举手打招呼形象）
      switchFrame('wave');
      const lines = getGreeting();
      const greetText = lines[Math.floor(Math.random() * lines.length)];
      // 招呼气泡:用 petSay 替换"我"为名字(只针对非歌词)
      Bubble.show(greetSay(greetText), { typing: false });
      // 2s 后移除 CSS 动画类，并切回 idle
      setTimeout(() => {
        pet.classList.remove('wave', 'nod');
        switchFrame('idle');
      }, 2000);
    } else if (action === 'sing') {
      // 让它唱首歌 —— 选歌词(带 ｜) + 切到 sing 帧 + TTS 朗读
      if (typeof showSingingBubble === 'function') {
        showSingingBubble();
      } else if (typeof highlightOn === 'function') {
        // 兜底
        highlightOn();
      }
    } else if (action === 'speak') {
      // 右键菜单"🔊 朗读这条" —— 强制朗读当前气泡(忽略 5s 冷却)
      if (window._ttsSpeak) {
        // 优先读 pinnedText(当前显示的气泡),否则用最近一个气泡
        const text = window._currentBubbleText || '';
        if (text && window._ttsSpeak) {
          window._ttsSpeak(text);
        }
      }
    } else if (action === 'smile') {
      // 右键菜单"笑一下"：立即切到眯眼帧(锁住、不自动回)，气泡消失后才回 idle
      // 守卫 1：sleep 帧不抢 —— 睡觉时笑就破坏睡眠语义了
      if (currentFrame === 'sleep') return;
      // 其他状态都允许打断（sing/wave/blink 都可以被"笑一下"覆盖 —— 是用户主动行为）
      // - sing → 直接打断唱歌去笑（用户明确选择）
      // - wave → 还在 2 秒挥手期时也能笑（直接覆盖）
      // - blink  → 已经在笑时再触发,会重新触发一次气泡计时；安全无副作用

      // 锁定到眯眼（不调 blink() 那个自动回 idle 的版本；用 switchFrame 直接锁）
      switchFrame('blink');
      // 节日联动文案 —— 按皮肤分支（每个皮肤气质不同）
      const f = currentFestival();
      const fkey = f ? f.key : 'default';
      const skinId = window._activeSkinId || 'default';
      const smileBySkin = {
        '阳光天使': {
          'dragon-boat': '今天阳光真好~',
          'mid-autumn':  '照亮你的好心情',
          'spring':      '新年给你一点光',
          'new-year':    '新的一年暖着走',
          'birthday':    '祝你被温柔照亮',
          'default':     '会一直陪着你的',
        },
        '端午卜': {
          'dragon-boat': '嘿嘿~粽叶香~',
          'mid-autumn':  '嘿嘿~月亮好圆',
          'spring':      '嘿嘿~新年快乐',
          'new-year':    '嘿嘿~新的一年',
          'birthday':    '嘿嘿~今天最开心',
          'default':     '嘿嘿~',
        },
        'default': {
          'dragon-boat': '嘿嘿~粽叶香~',
          'mid-autumn':  '嘿嘿~月亮好圆',
          'spring':      '嘿嘿~新年快乐',
          'new-year':    '嘿嘿~新的一年',
          'birthday':    '嘿嘿~今天最开心',
          'default':     '嘿嘿~',
        },
      };
      const lines = smileBySkin[skinId] || smileBySkin.default;
      const txt = lines[fkey];
      // 注册 onHide：气泡淡出完成后,如果当前还是 blink 帧(没被中途切换),回 idle
      Bubble.show(txt, {
        typing: false,
        onHide: () => {
          if (currentFrame === 'blink') {
            switchFrame('idle');
          }
          // 守卫 2：如果用户中途切皮肤/触发 sleep/sing 等,currentFrame 已不是 blink,
          // 这里自动 no-op,不强行覆盖其他状态
        },
      });
    } else if (action === 'heart') {
      // 比心: 在桌宠中心点周围随机生成 6-8 颗爱心
      if (window.spawnHeartAtPet) {
        const r = hitArea.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const count = 6 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          setTimeout(() => {
            const offsetX = (Math.random() - 0.5) * 60;
            const offsetY = (Math.random() - 0.5) * 30;
            if (window.spawnHeart) window.spawnHeart(cx + offsetX, cy + offsetY);
          }, i * 80);  // 错开一点时间,看起来是连发
        }
      }
      Bubble.show('比心~ 💖', { typing: false, duration: 2000 });
    } else if (action === 'sleep') {
      // 睡觉：切换到 pet-sleep.png（持续闭眼）+ 身体缩小 + Zzz 浮动 + 气泡
      pet.classList.remove('shake', 'shrink', 'walk', 'nod', 'wave', 'bye');
      void pet.offsetWidth;
      pet.classList.add('sleep');
      // 切换到持续闭眼 PNG（BFS 抠图 + arc 绘制的 pet-sleep.png）
      forceFrame('sleep');
      // 加 Zzz 浮动元素
      addZzz();
      Bubble.show('Zzz... 我先小憩一会儿~', { typing: true, duration: 0 });
      // 暂停闲置动画（避免和 sleep 冲突）
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      // 5 秒后醒来
      setTimeout(() => {
        pet.classList.remove('sleep');
        // 切回 idle（睁眼），再眨眼一次
        forceFrame('idle');
        removeZzz();
        Bubble.show('哈~ 醒啦！', { typing: true, duration: 2000 });
        // 醒来的瞬间眨一下
        setTimeout(() => blink(280), 100);
        // 恢复闲置计时
        resetIdleTimer();
      }, 5000);
    } else if (action === 'bye') {
      // 拜拜：大幅挥手 + 气泡（主进程会接着调用 app.quit）
      pet.classList.remove('shake', 'shrink', 'walk', 'nod', 'wave', 'sleep');
      void pet.offsetWidth;
      pet.classList.add('bye');
      Bubble.show('拜拜~ 下次见！', { typing: true, duration: 1500 });
    } else if (action === 'hydrated') {
      // v1.13 喝水打卡
      Bubble.show('喝水打卡~ 继续保持 💧', { typing: true, duration: 2200 });
    } else if (action === 'stretched') {
      // v1.13 久坐重置
      Bubble.show('活动打卡~ 身体棒棒 🪑', { typing: true, duration: 2200 });
    } else if (action === 'add-line') {
      // 加金句
      const line = await customPrompt('加一句金句(留给以后随机用):');
      if (line && line.trim()) {
        window.petAPI.customLines('add', line.trim()).then((lines) => {
          window._customLines = lines;
          Bubble.show('记下啦~', { typing: false, duration: 1500 });
        }).catch(() => {});
      }
    } else if (action === 'add-anniversary') {
      // 加纪念日
      const label = await customPrompt('纪念日名称(如:生日/在一起):');
      if (!label) return;
      const now = new Date();
      const defMd = `${now.getMonth() + 1}-${now.getDate() + 1}`;
      const md = await customPrompt('日期(月-日,如 7-15 或 12-25):', defMd);
      if (!md) return;
      const [mm, dd] = md.split('-').map(s => parseInt(s.trim(), 10));
      if (!mm || !dd || mm < 1 || mm > 12 || dd < 1 || dd > 31) {
        Bubble.show('日期格式错了哦~', { typing: false, duration: 1500 });
        return;
      }
      window.petAPI.anniversaries('add', { month: mm, day: dd, label, advance: true }).then((items) => {
        window._anniversaries = items;
        Bubble.show(`${label} 记下啦~`, { typing: false, duration: 2000 });
      }).catch(() => {});
    }
  });

  // ============================================================
  //  启动问候已整合到 showStartupGreeting() —— 优先级: 生日 > 纪念日 > 节日/时段 + 天气
  //  见 line ~1754
  // ============================================================

  // 初始：开启点击穿透
  window.petAPI.setIgnoreMouse(true);

  // 初始化当前激活皮肤（用于 smile/idle 气泡按皮肤分支）
  window._activeSkinId = 'default';
  window.petAPI.getSkin().then((info) => {
    if (info && info.activeSkin) {
      window._activeSkinId = info.activeSkin;
    }
  }).catch(() => {});

  // 互动统计初始化 + 每日激活判断
  // 用 lastActiveAt 的日期部分 vs 今天的日期比较,
  // 不同则累加 activeDays(避免时区/重启导致重复算)
  window.petAPI.stat('get').then((stats) => {
    if (!stats) return;
    if (!stats.firstLaunchAt) {
      window.petAPI.stat('init').catch(() => {});
    }
    const today = new Date().toDateString();
    const last = stats.lastActiveAt ? new Date(stats.lastActiveAt).toDateString() : null;
    if (last !== today) {
      window.petAPI.stat('activeDay').catch(() => {});
    }
    window._stats = stats;
  }).catch(() => {});

  // 加载用户偏好(bubbleFrequency / typingSpeed / theme)
  // 写到 window._prefs 后,所有 Bubble.show / 闲置 timer / highlightOn 自动用最新值
  window._prefs = {};
  window._prefsLoaded = false;  // 标记:第一次 getPrefs 还没回来之前,prefs-changed 消息先到会被缓存

  // 宠物档案(name / birthday / zodiac / gender / mbti) —— v1.8
  // 暴露到 window._petProfile,主进程通过 pet:profile-changed 实时更新
  window._petProfile = {};

  // 应用桌宠缩放(0.8-1.2) —— 通过 CSS 变量 --pet-scale 缩放内部元素
  // 关键:不能用 body.zoom + setBounds 双重缩放,会让气泡定位计算/视觉位置不一致
  // 单一策略:setBounds 改窗口大小,CSS calc(136px * var(--pet-scale)) 让内部元素按比例缩
  function applyPetScale(scale) {
    const s = Math.max(0.5, Math.min(1.5, Number(scale) || 1.0));
    document.documentElement.style.setProperty('--pet-scale', String(s));
    // 通知主进程调整窗口大小(主进程会按 scale 重设 bounds)
    if (window.petAPI && window.petAPI.resizeWindow) {
      window.petAPI.resizeWindow(s);
    }
  }

  // 把"我"换成 petName(只在招呼/节日/纪念日等非歌词气泡用,HOVER_BUBBLES 的歌词不动)
  // 规则:仅替换"我"为名字 —— "我陪你~" → "小布陪你~"
  // 不替换"我的"等可能破坏语义的(可以后续做精细匹配)
  function petSay(text) {
    if (!text) return text;
    const name = (window._petProfile && window._petProfile.name || '').trim();
    if (!name) return text;
    // 不替换五月天歌词(以 "｜" 连接的当成歌词)
    if (text.includes('｜')) return text;
    return text.replace(/^我(?=[^一-龥]|$)/, name)
               .replace(/([^一-龥])我(?=[^一-龥]|$)/g, '$1' + name);
  }

  // ============================================================
  //  拟人化气泡 —— 性别 + MBTI 影响
  // ============================================================
  // 性别语气词后缀(随机抽一个,让气泡不重复)
  const GENDER_TONE = {
    female: ['呀~', '啦~', '哦~', '呢~', '~♡', '~', '哈~', '嘻嘻~'],
    male:   ['哟~', '呢~', '哈~', '嘛~', '~', '哦~', '~', '嘿~'],
    other:  ['~', '哦~', '呢~', '哈~', '~', '~', '~', '~'],
  };
  // 性别自称词后缀(在"我"前/后加)
  // female 加 "呀" "哦" 等;male 加 "哥" "兄";other 改"本人"
  const GENDER_SELF = {
    female: { prefix: '', suffix: '呀' },
    male:   { prefix: '', suffix: '哟' },
    other:  { prefix: '', suffix: '呢' },
  };
  // 性别 emoji 后缀
  const GENDER_EMOJI = {
    female: '🌸',
    male:   '🍀',
    other:  '✨',
  };
  // MBTI emoji 标识
  const MBTI_EMOJI = {
    ISTJ: '📋', ISFJ: '🌷', INFJ: '🌙', INTJ: '🧠',
    ISTP: '🔧', ISFP: '🎨', INFP: '🌸', INTP: '💭',
    ESTP: '⚡', ESFP: '🎉', ENFP: '🌈', ENTP: '💡',
    ESTJ: '🛡️', ESFJ: '🤝', ENFJ: '💝', ENTJ: '👑',
  };
  // MBTI 句长调整
  // E(外向)→ 句长加长,加尾句
  // I(内向)→ 句长缩短,去尾句
  // T(思考)→ 减少情感词
  // F(感受)→ 增加情感词
  // J(判断)→ 加"应该""得"等确定性词
  // P(感知)→ 加"也许""可能"等
  // 抽取 MBTI 4 个维度
  function getMBTIDim(mbti) {
    if (!mbti || mbti.length < 4) return null;
    return {
      E_I: mbti[0],  // E / I
      S_N: mbti[1],  // S / N
      T_F: mbti[2],  // T / F
      J_P: mbti[3],  // J / P
    };
  }
  // MBTI 16 套独立短句词包(每套 4-5 句"独白")
  const MBTI_LINES = {
    ISTJ: ['事情一件件来,不要慌。', '规矩就是规矩呀。', '该做的事不会拖。', '稳定最重要。'],
    ISFJ: ['能帮到你我很开心~', '你累不累?要不要歇一下?', '记得按时吃饭呀。', '有我在呢~'],
    INFJ: ['我能感受到你。', '世界需要更多温柔。', '安静的时候在想你呢。', '你心里有光。'],
    INTJ: ['一切都在计划中。', '逻辑自洽最重要。', '效率,效率。', '长远来看是对的。'],
    ISTP: ['嗯,试试看。', '动手解决最直接。', '出了问题再修嘛~', '冷静分析就好。'],
    ISFP: ['现在这样就很好。', '美无处不在呀。', '感觉对了就去做~', '随性一点吧~'],
    INFP: ['梦想还是要有的。', '你在意的人,也有人在意的。', '世界可以更温柔~', '心里有花就开吧。'],
    INTP: ['这个问题有意思。', '先想清楚再说。', '理论先于实践。', '可能性太多了。'],
    ESTP: ['干就完了!', '冲!', '现在就是最好的时机。', '别磨叽,走起~'],
    ESFP: ['今天也是开心的一天!', '大家一起玩呀!', '来来来,嗨起来~', '笑容是最好的~'],
    ENFP: ['哇塞!好多可能性!', '太酷了吧!', '未来充满想象~', '心动不如行动!'],
    ENTP: ['换条路试试?说不定更好。', '有道理,但反过来说...', '打破常规!', '我的脑洞有点大~'],
    ESTJ: ['执行,执行,执行!', '规则要遵守。', '效率优先~', '目标明确,干就完了。'],
    ESFJ: ['大家开心就好~', '你的事就是我的事。', '和谐最重要呀~', '聚会怎么能少了我!'],
    ENFJ: ['我能帮你什么吗?', '你的感受我懂。', '一起成长呀~', '你一定能行的!'],
    ENTJ: ['目标锁定,执行!', '我的视野不止于此。', '战略决定一切。', '跟我来。'],
  };

  // 拟人化气泡: 名字 + 性别 + MBTI
  // - isMayday=true 时跳过(五月天歌词)
  // - isLyric 含 "｜" 时跳过
  // - isIdle 是闲置气泡,只加尾巴后缀(不重写)
  // - isGreetAction 是 greet 菜单招呼,套 MBTI 句库
  function personaSay(text, opts = {}) {
    if (!text) return text;
    const profile = window._petProfile || {};
    const name = (profile.name || '').trim();
    const gender = profile.gender || 'other';
    const mbti = (profile.mbti || '').trim();
    // 跳过歌词
    if (opts.isMayday || text.includes('｜')) return text;

    let out = text;

    // 1) 自称替换: "我" → 名字(沿用 petSay)
    if (name) {
      out = out.replace(/^我(?=[^一-龥]|$)/, name)
               .replace(/([^一-龥])我(?=[^一-龥]|$)/g, '$1' + name);
    }

    // 2) 性别语气后缀 + emoji
    if (gender && GENDER_TONE[gender]) {
      // 30% 概率加后缀(避免每个气泡都加)
      if (Math.random() < 0.3) {
        const suffixes = GENDER_TONE[gender];
        const suf = suffixes[Math.floor(Math.random() * suffixes.length)];
        out = out + (out.endsWith('~') || out.endsWith('!') || out.endsWith('?') ? '' : suf);
      }
    }

    // 3) MBTI 处理
    if (mbti) {
      const dim = getMBTIDim(mbti);
      if (dim) {
        // I(内向)→ 缩短(去掉尾句)
        if (dim.E_I === 'I' && Math.random() < 0.4 && out.length > 8) {
          // 找第一个逗号/句号,截断
          const m = out.match(/^([^,。!?~]+)/);
          if (m && m[1].length >= 4) out = m[1].trim();
        }
        // E(外向)→ 加长(30% 加尾句)
        if (dim.E_I === 'E' && Math.random() < 0.3) {
          const tails = ['~', '~哈哈', '!', '耶~', '呀~', '咯~'];
          out = out + tails[Math.floor(Math.random() * tails.length)];
        }
        // T(思考)→ 减少情感词
        if (dim.T_F === 'T' && Math.random() < 0.5) {
          out = out.replace(/~♡/g, '~').replace(/~❤️/g, '~');
        }
        // F(感受)→ 增加情感词
        if (dim.T_F === 'F' && Math.random() < 0.3) {
          const emot = ['~', '~♡', '~', '~❤️', '~'];
          const suf = emot[Math.floor(Math.random() * emot.length)];
          out = out + suf;
        }
        // J(判断)→ 加"应该""得"等
        // P(感知)→ 加"也许""可能"等 —— 简化:不做
      }
    }

    // 4) 加性别 + MBTI emoji 后缀(只在招呼/节日类气泡,greet 菜单)
    if (opts.addEmojiSuffix) {
      const e1 = GENDER_EMOJI[gender] || '';
      const e2 = MBTI_EMOJI[mbti] || '';
      const combo = (e1 + e2).trim();
      if (combo) out = out + ' ' + combo;
    }

    return out;
  }

  // 替闲置动画气泡包装:用 personaSay 轻度处理(只加尾巴 emoji)
  function idleSay(text) {
    return personaSay(text, { addEmojiSuffix: true });
  }

  // 替招呼菜单气泡包装:全量 personaSay(替换"我"+ 性别后缀 + MBTI 调整)
  function greetSay(text) {
    return personaSay(text, { addEmojiSuffix: true });
  }

  // 替 toast 包装:加 emoji 后缀
  function toastSay(text) {
    return personaSay(text, { addEmojiSuffix: true });
  }

  if (window.petAPI && window.petAPI.getPrefs) {
    window.petAPI.getPrefs().then((p) => {
      window._prefsLoaded = true;
      if (p) window._prefs = p;
      // 启动时应用缩放
      if (p && p.petScale) applyPetScale(p.petScale);
      // 如果在 getPrefs 回来之前,有 prefs-changed 来了,apply pending
      if (window._pendingPrefs) {
        Object.assign(window._prefs, window._pendingPrefs);
        if ('bubbleFrequency' in window._pendingPrefs) {
          if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
          idleTimer = setTimeout(triggerIdleAnimation, getIdleThreshold());
        }
        if ('petScale' in window._pendingPrefs) applyPetScale(window._pendingPrefs.petScale);
        window._pendingPrefs = null;
      }
    }).catch(() => { window._prefsLoaded = true; });
  }
  // 加载宠物档案(name / birthday / zodiac / gender / mbti) —— v1.8
  if (window.petAPI && window.petAPI.getProfile) {
    window.petAPI.getProfile().then((p) => {
      if (p) window._petProfile = p;
    }).catch(() => {});
  }
  // 监听档案变化(设置窗口改完,主进程广播)
  if (window.petAPI && window.petAPI.onProfileChanged) {
    window.petAPI.onProfileChanged((p) => {
      if (p) window._petProfile = p;
    });
  }

  // ============================================================
  //  v1.13 定时通知(番茄钟/喝水/久坐)—— 监听主进程推送
  // ============================================================
  // 去重:lastShownMinute 记录上次显示的状态气泡的"phase+remainMin"避免每 30s 重复
  let _lastNotifKey = '';
  if (window.petAPI && window.petAPI.onNotification) {
    window.petAPI.onNotification((data) => {
      if (!data || !data.type) return;
      // pomodoro-status 是频繁更新(每 30s 一次),只在分钟数变化时显示
      if (data.type === 'pomodoro-status') {
        const key = `${data.phase}|${data.remainMin}`;
        if (key === _lastNotifKey) return;  // 同分钟不重复
        _lastNotifKey = key;
        // 状态气泡:小气泡,1.5s,不打字
        if (Bubble && Bubble.show) {
          Bubble.show(data.text, { typing: false, duration: 1500 });
        }
        return;
      }
      // 其他通知:正常气泡
      // pomodoro-started / rest-start / work-start / stopped / hydration / sedentary
      // v1.13.1: pomodoro-rest-start 携带 todayCount,改成庆祝文案
      let text = data.text;
      let dur = 2000;
      let typing = true;
      if (data.type === 'pomodoro-started' || data.type === 'pomodoro-work-start') {
        dur = 2800;
      } else if (data.type === 'pomodoro-rest-start') {
        // 工作完成,根据 todayCount 显示不同庆祝文案 + 触发 celebrate 动画
        const cnt = data.todayCount || 1;
        text = cnt === 1
          ? '🎉 完成一个番茄!休息一下吧~'
          : `🎉 又完成一个!今日已 ${cnt} 个番茄`;
        dur = 3500;
        // v1.13.1: 触发庆祝动画(跳起来 + 缩放)
        if (pet) {
          pet.classList.remove('celebrate');
          void pet.offsetWidth;  // 强制重排,让动画能重播
          pet.classList.add('celebrate');
          setTimeout(() => pet.classList.remove('celebrate'), 1100);
        }
      } else if (data.type === 'hydration' || data.type === 'sedentary') {
        dur = 3500;
      } else if (data.type === 'pomodoro-stopped' || data.type === 'hydration-ack' || data.type === 'sedentary-ack') {
        dur = 2200;
      }
      if (Bubble && Bubble.show) {
        Bubble.show(text, { typing, duration: dur });
      }
    });
  }

  // ============================================================
  //  TTS 朗读 —— v1.11
  // ============================================================
  //  使用浏览器内置 SpeechSynthesis API (Electron = Chromium)
  //  Win32 上用 Edge TTS 中文女声 (Xiaoxiao / Yaoyao)
  //  朗读策略:
  //   - Bubble.show(text) → 如果开启,自动朗读
  //   - 5s 冷却(避免朗读太频繁)
  //   - 当前朗读队列只有一个(speechSynthesis.cancel() 打断旧的)
  //   - 歌词(｜ 分隔)只朗读第一行(避免唱歌听不清)
  // v1.11.2 策略调整: 不打断旧的 + 不重复读相同 text
  // 设计哲学:
  //   - TTS 是"连续朗读"流,不是"瞬时播报"
  //   - 用户期望: 看到 A 听到 A (但 Web Speech API 有 200-500ms 启动延迟)
  //   - 实际: 1-2s 内的气泡用同一段 text, 不应该重复读
  //   - 新 text 来时, 让旧读完成 (cancel 会让用户觉得"说一半停了")
  //   - 通过 _ttsCurrentText 标记"当前正在读" + 跳过相同 text

  // v1.11.5: 通用选声函数(根据 petProfile.gender 选男声/女声)
  //  - female → 优先 Xiaoxiao / Yaoyao / Huihui(温柔成年女声 → 儿童 → 正式)
  //  - male   → 优先 Yunyang / Kangkang / Yunxi(沉稳成年男声 → 年轻 → 青年)
  //  - other  → 优先 Xiaoxiao(温柔,不指定性别)
  // 用户可在 settings 里手动指定(留 TODO:v1.12)
  // v1.11.5: 通用选声函数(根据 petProfile.gender + tts.voicePref 选)
  //  - voicePref='auto'  → 按 gender 自动选男/女声
  //  - voicePref='female'/'male'/'other' → 强制选对应声音池
  //  - voicePref='custom' → 用 tts.customVoice 字符串匹配(子串匹配)
  function pickChineseVoice(gender) {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || !voices.length) return null;
    const tts = (window._prefs && window._prefs.tts) || {};
    const pref = tts.voicePref || 'auto';
    // 1) custom: 按用户填的声音名匹配(不区分大小写子串)
    if (pref === 'custom' && tts.customVoice && tts.customVoice.trim()) {
      const needle = tts.customVoice.trim();
      const v = voices.find(v => v.name.toLowerCase().includes(needle.toLowerCase()));
      if (v) return v;
      // 没匹配到 → fallback 到 auto
    }
    // 2) 强制选某个声音池
    let forced;
    if (pref === 'female') forced = 'female';
    else if (pref === 'male') forced = 'male';
    else if (pref === 'other') forced = 'other';
    else forced = gender || 'other';  // auto: 用 petProfile.gender
    let candidates;
    if (forced === 'male') {
      // v1.11.5: 移除 Sin-ji(粤语女声,误匹配) + zh-CN(name 里没 zh-CN 字符串,永远不匹配)
      candidates = [
        /Microsoft Yunyang/i, /Microsoft Kangkang/i, /Microsoft Yunxi/i,
        /Danny/i,  // 港粤男声
      ];
    } else if (forced === 'other') {
      candidates = [
        /Microsoft Xiaoxiao/i, /Microsoft Yunyang/i,
      ];
    } else {
      // female
      candidates = [
        /Microsoft Xiaoxiao/i, /Microsoft Yaoyao/i, /Microsoft Huihui/i,
        /Tingting/i, /Tracy/i, /Mei/i, /Yating/i,
      ];
    }
    for (const re of candidates) {
      const v = voices.find(v => re.test(v.name));
      if (v) return v;
    }
    // v1.11.5: 第二层 fallback —— 按性别找任意 zh voice
    if (forced === 'male') {
      // 找所有 zh voice,然后用 voice name 启发式判断男女
      // 男声关键词:Yunyang/Kangkang/Yunxi/Guy/Haoxiang/Ryan/David/Mark 等
      const maleKeywords = /Yunyang|Kangkang|Yunxi|Guy|Haoxiang|Ryan|David|Mark/i;
      const maleVoice = voices.find(v => v.lang && v.lang.startsWith('zh') && maleKeywords.test(v.name));
      if (maleVoice) return maleVoice;
      // v1.11.5 fix: 强制男声但找不到男声 → 不返回女声!让浏览器用系统默认
      return null;
    } else if (forced === 'female') {
      const femaleKeywords = /Xiaoxiao|Yaoyao|Huihui|Tingting|Xiaomeng|Xiaoyi/i;
      const femaleVoice = voices.find(v => v.lang && v.lang.startsWith('zh') && femaleKeywords.test(v.name));
      if (femaleVoice) return femaleVoice;
      return null;
    }
    // auto + other: 任意中文 voice(用户没明确偏好,系统默认 OK)
    return voices.find(v => v.lang && v.lang.startsWith('zh')) || voices[0];
  }

  function speakBubble(text, opts = {}) {
    if (!text) return false;
    let ttsText = text;
    // v1.11.4: fullText=true 时朗读完整歌词(右键"唱歌"用)
    //          默认 false(打招呼/状态反馈/dodge 只读第一行,避免过长)
    if (!opts.fullText && ttsText.includes('｜')) {
      ttsText = ttsText.split('｜')[0];
    }
    // 过滤纯 emoji / 标点
    ttsText = ttsText.replace(/[^\u4e00-\u9fa5\u3040-\u30ffa-zA-Z0-9\s,。.!?~]/g, '').trim();
    if (!ttsText) return false;

    const ttsPref = (window._prefs && window._prefs.tts) || {};

    // v1.11.5: 走主进程 edge-tts + sound-play(绕开 transparent window audio 限制)
    if (window.petAPI && window.petAPI.ttsSpeak) {
      let voiceOpt = null;
      if (ttsPref.voicePref === 'custom' && ttsPref.customVoice) {
        voiceOpt = ttsPref.customVoice;
      }
      const ratePct = Math.round(((ttsPref.rate || 1.0) - 1.0) * 100);
      const pitchHz = Math.round(((ttsPref.pitch || 1.0) - 1.0) * 50);
      const volPct = Math.round(((ttsPref.volume || 1.0) - 1.0) * 100);

      // 不在 renderer 播,也不 fallback(主进程失败就静默 — 因为 fallback 也只是机械音,不如静默)
      window.petAPI.ttsSpeak(ttsText, {
        voice: voiceOpt || undefined,
        rate: (ratePct >= 0 ? '+' : '') + ratePct + '%',
        pitch: (pitchHz >= 0 ? '+' : '') + pitchHz + 'Hz',
        volume: (volPct >= 0 ? '+' : '') + volPct + '%',
      }).then((r) => {
        if (!r || !r.ok) {
          console.warn('[TTS] main-process tts failed:', r && r.error);
        }
      }).catch((e) => {
        console.error('[TTS] IPC failed:', e.message);
      });
      return true;
    }

    // 没有 petAPI.ttsSpeak → fallback
    return fallbackWebSpeech(ttsText, opts);
  }

  // 兜底:本地 Web Speech API —— 网络挂了时也能说话
  function fallbackWebSpeech(ttsText, opts) {
    if (!window.speechSynthesis) return false;
    try {
      const u = new SpeechSynthesisUtterance(ttsText);
      const gender = (window._petProfile && window._petProfile.gender) || 'other';
      const v = pickChineseVoice(gender);
      if (v) {
        u.voice = v;
        u.lang = v.lang || 'zh-CN';
      } else {
        u.lang = 'zh-CN';
      }
      const ttsPref = (window._prefs && window._prefs.tts) || {};
      u.rate = ttsPref.rate || 1.0;
      u.pitch = ttsPref.pitch || 1.0;
      u.volume = ttsPref.volume || 1.0;
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) {
      return false;
    }
  }
  // 暴露到 window 供其他模块用(右键菜单手动朗读)
  window._ttsSpeak = speakBubble;
  // 兜底 Web Speech API —— 仅在 edge-tts 失败时启用
  // prefill voices 列表以加速 voiceschanged
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
  }

  // ============================================================
  //  启动问候 + 天气播报 —— v1.9
  // ============================================================
  //  设计:
  //   1. 等 getPrefs 回来(已经合并 profile + 设置)
  //   2. 生成时段问候语(早/午/晚)
  //   3. 如果 weather.enabled,异步拉天气数据
  //   4. 合并成一个气泡 show 出去
  //  防打扰:
  //   - greeting-shown 标志,一天只 show 一次
  //   - 启动后 1500ms 延迟(等图片加载完,避免气泡在 transparent 上)
  function buildGreeting() {
    const h = new Date().getHours();
    let period;
    if (h < 6) period = 'late';         // 凌晨
    else if (h < 11) period = 'morning'; // 早
    else if (h < 13) period = 'noon';    // 午
    else if (h < 18) period = 'afternoon';// 下午
    else if (h < 22) period = 'evening';  // 晚
    else period = 'late';                // 深夜
    const greets = {
      late:      ['夜深了~', '还不睡呀?', '这么晚啦~', '还在呢~'],
      morning:   ['早安~', '早上好呀!', '新的一天!', '早~☀️'],
      noon:      ['午安~', '中午好!', '吃饭了吗?', '午休一下~'],
      afternoon: ['下午好~', '还顺利吗?', '加油呀~', '摸会儿鱼?'],
      evening:   ['晚上好~', '辛苦啦!', '今天累不累?', '晚安~'],
    };
    const list = greets[period] || greets.morning;
    return list[Math.floor(Math.random() * list.length)];
  }

  function buildWeatherPart(w) {
    if (!w || !w.ok) return null;
    // 拼接:emoji + 城市 + 描述 + 温度
    return `${w.emoji} ${w.location}${w.desc},${w.temp}°C`;
  }

  // 加点温度相关建议(雨带伞、晒防晒等)
  function buildWeatherAdvice(w) {
    if (!w || !w.ok) return null;
    const code = w.desc;
    if (code.includes('雨')) return '记得带伞~';
    if (code.includes('雪')) return '注意保暖~';
    if (w.temp >= 30) return '注意防晒呀~';
    if (w.temp <= 5) return '穿厚点哦~';
    if (w.temp <= 15) return '加件外套~';
    return null;
  }

  // 一天只 show 一次启动问候(本地存储日期戳)
  function shouldShowStartupGreeting() {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const last = localStorage.getItem('pet-startup-greet-date');
      return last !== today;
    } catch (e) {
      return true;
    }
  }
  function markStartupGreetingShown() {
    const today = new Date().toISOString().slice(0, 10);
    try { localStorage.setItem('pet-startup-greet-date', today); } catch (e) {}
  }

  async function showStartupGreeting() {
    if (shouldShowStartupGreeting()) {
      markStartupGreetingShown();
    }
    // v1.0: 首次启动 onboarding 引导(只一次)
    if (typeof localStorage !== 'undefined' && !localStorage.getItem('pet-onboarded')) {
      await new Promise(r => setTimeout(r, 800));
      Bubble.show('欢迎!我是你的桌面宠物 🐾', { typing: true, duration: 2800 });
      await new Promise(r => setTimeout(r, 3500));
      Bubble.show('左键拖动我 ｜ 单击我会躲闪 ｜ 右键看菜单', { typing: true, duration: 3500 });
      await new Promise(r => setTimeout(r, 4200));
      Bubble.show('右键 → ⚙️ 设置 可以改名字/换皮肤/番茄钟', { typing: true, duration: 3800 });
      try { localStorage.setItem('pet-onboarded', '1'); } catch (e) {}
      return;  // 首次启动只走 onboarding,不显示普通问候
    }
    // 0.8s 后立刻 show 简短问候(不等 PNG 完整加载)
    await new Promise(r => setTimeout(r, 800));

    // === 优先级: 生日 > 纪念日 > 节日/时段 + 天气 ===
    // 1) 生日(优先)
    const birthdayGreeting = checkPetBirthday();
    if (birthdayGreeting) {
      Bubble.show(greetSay(birthdayGreeting), { typing: true, duration: 6000 });
      return;
    }
    // 2) 纪念日(当天/明天)
    const ann = checkAnniversaries();
    if (ann) {
      const prefix = ann.advance ? '提前提醒~ 明天是' : '今天是个特别的日子~';
      const lines = [
        `${prefix}【${ann.label}】`,
        `${ann.advance ? '记得哦' : '陪你过'}${ann.label}~`,
        `${ann.label}${ann.advance ? '要来了' : '快乐'}！`,
      ];
      Bubble.show(lines[Math.floor(Math.random() * lines.length)], { typing: true, duration: 5000 });
      return;
    }

    // 3) 时段 + 节日问候(可混星座运势)
    const greetingLines = getGreeting();
    let greetBase = greetingLines[Math.floor(Math.random() * greetingLines.length)];
    const zodiac = (window._petProfile && window._petProfile.zodiac) || '';
    if (zodiac && Math.random() < 0.3) {
      const fortune = getDailyZodiacFortune(zodiac);
      if (fortune) greetBase = `【${zodiac}今日运】${fortune}`;
    }
    const weatherCfg = (window._prefs && window._prefs.weather) || { city: '', enabled: true };

    // 第一阶段: 立即 show 问候(短)
    const quickText = greetSay(greetBase, { isMayday: false });
    Bubble.show(quickText, { typing: true, duration: 2000 });

    // 第二阶段: 异步拉天气, 拿到后 show 完整气泡
    if (!weatherCfg.enabled || !window.petAPI || !window.petAPI.getWeather) {
      return;
    }

    let resolvedLocation = weatherCfg.city;
    let weatherData = null;

    if (!weatherCfg.city) {
      try {
        const ipLoc = await window.petAPI.getIpLocation();
        if (ipLoc && ipLoc.ok && ipLoc.city) {
          resolvedLocation = ipLoc.city;
        }
      } catch (e) { /* 静默,IP 定位失败就用空 */ }
    }

    try {
      const w = await window.petAPI.getWeather(resolvedLocation || '');
      if (w && w.ok) weatherData = w;
    } catch (e) { /* 静默 */ }

    if (!weatherData) return;

    const weatherPart = buildWeatherPart(weatherData);
    const advice = buildWeatherAdvice(weatherData);
    const parts = [greetBase];
    if (weatherPart) parts.push(`今天 ${weatherPart}`);
    if (advice) parts.push(advice);
    const fullText = greetSay(parts.join('｜'), { isMayday: false });

    // 等第一个气泡消失 (2s 持续) + 0.3s 间隔
    await new Promise(r => setTimeout(r, 2300));
    Bubble.show(fullText, { typing: true, duration: 5000 });
  }

  // 启动时 show 问候: 0.8s 后(等 PNG 主图加载 + 不等完整就绪)
  setTimeout(showStartupGreeting, 200);
  // 监听设置变化(设置窗口调 setPrefs 后,主进程发 pet:prefs-changed)
  if (window.petAPI && window.petAPI.onPrefsChanged) {
    window.petAPI.onPrefsChanged((prefs) => {
      // 关键:如果 getPrefs 还没回来(慢启动),先缓存,等 getPrefs 回来再 merge
      // 否则 prefs-changed 之后的值会被 getPrefs 旧值覆盖,导致改了无效
      if (!window._prefsLoaded) {
        if (!window._pendingPrefs) window._pendingPrefs = {};
        Object.assign(window._pendingPrefs, prefs);
        return;
      }
      Object.assign(window._prefs, prefs);
      // 频率改变时,清掉旧 idleTimer,排新的(否则要等当前 timer 跑完才生效)
      if ('bubbleFrequency' in prefs) {
        if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
        idleTimer = setTimeout(triggerIdleAnimation, getIdleThreshold());
      }
      // 桌宠缩放:实时生效
      if ('petScale' in prefs) applyPetScale(prefs.petScale);
      // 词库/打字机: 下次 Bubble.show 自动用新值
    });
  }

  // 加载用户自定义金句(供 highlightOn + greet 菜单使用)
  window.petAPI.customLines('get').then((lines) => {
    window._customLines = lines || [];
  }).catch(() => { window._customLines = []; });

  // 加载纪念日
  window.petAPI.anniversaries('get').then((items) => {
    window._anniversaries = items || [];
  }).catch(() => { window._anniversaries = []; });

  // 加载气泡反馈评分 —— 用于偏好学习
  // getSkin IPC 不可用,直接读 settings.json? 用 stat('get') 路径不对。
  // 我们没有暴露 getSettings,用 stat('get') 拿 stats 不够。
  // 简单方案:启动时从 settings 读,后续由 IPC bubbleFeedback 累加后实时保存。
  // 初始 ratings 用 read() 拿不到(没有这个 IPC),先空对象,后续反馈会创建。
  window._bubbleRatings = {};

  // 反馈回调: 喜欢/不喜欢 —— 通过 IPC 累加评分
  window._onBubbleFeedback = (text, isLike) => {
    if (!text) return;
    window.petAPI.bubbleFeedback(text, isLike).then((score) => {
      window._bubbleRatings[text] = score;
    }).catch(() => {});
  };

  // ============================================================
  //  拖拽 PNG 到窗口 —— 换皮肤
  // ============================================================
  // 必须在 document 上监听,hitArea 接收 mousedown 事件,会拦截 dragenter。
  // 视觉提示: 拖动时给 .pet 加 dragging 视觉(已有)
  let dragDepth = 0;  // dragenter/dragleave 嵌套计数
  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth++;
    pet.classList.add('drop-hover');
  });
  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) pet.classList.remove('drop-hover');
  });
  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragDepth = 0;
    pet.classList.remove('drop-hover');
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    // 找第一个 PNG
    const png = files.find(f => f.type === 'image/png' || /\.png$/i.test(f.name));
    if (!png) {
      Bubble.show('只要 PNG 哦~', { typing: false, duration: 1500 });
      return;
    }
    // 读取成 base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      // 弹菜单让用户给皮肤起名
      const name = window.prompt('新皮肤名称(也是列表里的标识):', png.name.replace(/\.png$/i, ''));
      if (!name) return;
      Bubble.show('正在装新皮肤~', { typing: true, duration: 1500 });
      try {
        const res = await window.petAPI.installSkin({ name, pngBase64: base64 });
        if (res.ok) {
          window._activeSkinId = res.skinId;
          Bubble.show('换好啦~ 喜欢吗？', { typing: true, duration: 2500 });
        } else {
          Bubble.show('出错了:' + (res.error || '?'), { typing: false, duration: 3000 });
        }
      } catch (e) {
        Bubble.show('安装失败:' + e.message, { typing: false, duration: 3000 });
      }
    };
    reader.readAsDataURL(png);
  });

  // 监听皮肤切换事件（主进程推送新 frames-embed.js 内容 + 皮肤 id）
  // eval 出新的 PET_FRAMES，替换 frameImgs 的 src，等所有加载完才切 idle
  // 关键：图片替换 src 时会被浏览器立即显示新 src 的 alt，
  //       所以在加载完成前 **强制 opacity=0** 防止显示破碎图标
  window.petAPI.onSkinChanged((data) => {
    // 兼容两种格式：字符串（旧） / { skinId, framesContent }（新）
    let skinId, framesScriptContent;
    if (typeof data === 'string') {
      framesScriptContent = data;
    } else if (data && typeof data === 'object') {
      skinId = data.skinId;
      framesScriptContent = data.framesContent;
    }
    if (skinId) window._activeSkinId = skinId;

    try {
      // eslint-disable-next-line no-eval
      eval(framesScriptContent);
      const newFrames = window.PET_FRAMES || {};
      // 立即更新 FRAMES 引用（forceFrame 用）
      FRAMES = newFrames;
      // 全部先隐藏（包括 idle），等所有帧加载完再显示 idle
      for (const name of FRAME_NAMES) {
        if (frameImgs[name]) {
          frameImgs[name].style.opacity = '0';
        }
      }
      // 替换 src + 等待加载 + 加载完后才显示
      const loadPromises = [];
      for (const name of FRAME_NAMES) {
        if (newFrames[name] && frameImgs[name]) {
          frameImgs[name].src = newFrames[name];
          loadPromises.push(new Promise((resolve) => {
            if (frameImgs[name].complete && frameImgs[name].naturalWidth > 0) {
              resolve();
            } else {
              const onDone = () => resolve();
              frameImgs[name].onload = onDone;
              frameImgs[name].onerror = onDone;
            }
          }));
        }
      }
      // 等所有帧加载完再切到 idle（避免显示 alt）
      // 兜底：3s 后强制 forceFrame，避免图片加载卡住导致永久透明
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3000));
      Promise.race([Promise.all(loadPromises), timeoutPromise]).then(() => {
        forceFrame('idle');
      });
    } catch (e) {
      console.error('皮肤切换失败:', e);
    }
  });
})();