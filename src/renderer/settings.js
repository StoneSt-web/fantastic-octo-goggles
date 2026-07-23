// 设置面板 renderer —— 通过 settingsAPI(preload 暴露)读写 prefs 和 stats
// init 失败用 console.error(不进文件,只在 DevTools 看)


async function loadAll() {
  const [prefs, stats, skinInfo, profile] = await Promise.all([
    window.settingsAPI.getPrefs(),
    window.settingsAPI.getStats(),
    window.settingsAPI.getSkin(),
    window.settingsAPI.getProfile(),
  ]);
  return { prefs, stats, skinInfo, profile };
}

async function applyPrefs(prefs) {
  return window.settingsAPI.setPrefs(prefs);
}

async function applyProfile(profile) {
  return window.settingsAPI.setProfile(profile);
}

// 档案 toast 风格化 —— 性别 + MBTI 影响
//  性别: female 加 🌸, male 加 🍀, other 加 ✨
//  MBTI: 加对应 emoji
//  主进程 setProfile 之后会通过 pet:profile-changed 广播
//  我们用 local cache 储存最近一次 profile,用于 toast 加 emoji
let _lastProfile = null;
window.settingsAPI.getProfile().then(p => { _lastProfile = p || {}; });
// 监听档案变化,更新 toast 加的 emoji
window.settingsAPI.onProfileChanged((p) => { _lastProfile = p || {}; });

const GENDER_EMOJI = { female: '🌸', male: '🍀', other: '✨' };
const MBTI_EMOJI = {
  ISTJ: '📋', ISFJ: '🌷', INFJ: '🌙', INTJ: '🧠',
  ISTP: '🔧', ISFP: '🎨', INFP: '🌸', INTP: '💭',
  ESTP: '⚡', ESFP: '🎉', ENFP: '🌈', ENTP: '💡',
  ESTJ: '🛡️', ESFJ: '🤝', ENFJ: '💝', ENTJ: '👑',
};
function styleToast(text) {
  const p = _lastProfile || {};
  const e1 = GENDER_EMOJI[p.gender] || '';
  const e2 = MBTI_EMOJI[p.mbti] || '';
  const suffix = (e1 + e2).trim();
  if (!suffix) return text;
  return text + ' ' + suffix;
}

// 等级系统 —— 7 级称号
const LEVELS = [
  { name: '初识', icon: '🌱', minClicks: 0 },
  { name: '萌芽', icon: '🌿', minClicks: 10 },
  { name: '开花', icon: '🌸', minClicks: 30 },
  { name: '结果', icon: '🍎', minClicks: 80 },
  { name: '丰盛', icon: '🌳', minClicks: 200 },
  { name: '守护', icon: '🛡️', minClicks: 500 },
  { name: '传说', icon: '👑', minClicks: 1000 },
];

function getLevel(totalClicks) {
  let cur = LEVELS[0];
  let next = LEVELS[1];
  for (let i = 0; i < LEVELS.length; i++) {
    if (totalClicks >= LEVELS[i].minClicks) {
      cur = LEVELS[i];
      next = LEVELS[i + 1] || null;
    }
  }
  return { cur, next };
}

function renderLevel(stats) {
  const totalClicks = (stats.totalClicks || 0) + (stats.totalDrags || 0) + (stats.totalBubbles || 0);
  const { cur, next } = getLevel(totalClicks);
  document.getElementById('levelName').textContent = cur.name;
  document.querySelector('.level-icon').textContent = cur.icon;
  const fill = document.getElementById('levelFill');
  const tip = document.getElementById('levelTip');
  if (next) {
    const progress = (totalClicks - cur.minClicks) / (next.minClicks - cur.minClicks);
    fill.style.width = Math.min(100, progress * 100).toFixed(1) + '%';
    const need = next.minClicks - totalClicks;
    tip.textContent = `距离「${next.name}」还差 ${need} 次互动`;
  } else {
    fill.style.width = '100%';
    tip.textContent = '已达最高级 🎉';
  }
}

function renderStats(stats) {
  document.getElementById('statClicks').textContent = stats.totalClicks || 0;
  document.getElementById('statDrags').textContent = stats.totalDrags || 0;
  document.getElementById('statBubbles').textContent = stats.totalBubbles || 0;
  document.getElementById('statDays').textContent = stats.activeDays || 0;
}

function renderSkinPreview(skinInfo) {
  const name = document.getElementById('skinName');
  name.textContent = skinInfo.activeSkin || '未选择';
  // 简化:用 emoji 头像(避免跨窗口传 frame base64)
  const skinEmoji = {
    '阳光天使': '☀️',
    '端午卜': '🐉',
    '倔强死神': '💀',
  };
  const img = document.getElementById('skinPreviewImg');
  img.style.display = 'none';
  const emojiDiv = document.createElement('div');
  emojiDiv.textContent = skinEmoji[skinInfo.activeSkin] || '🐾';
  emojiDiv.style.cssText = 'font-size:32px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.05);border-radius:8px;';
  img.parentNode.insertBefore(emojiDiv, img);
}

// ============================================================
//  控件交互
// ============================================================
function setupFreqSeg(prefs) {
  const seg = document.getElementById('freqSeg');
  seg.querySelectorAll('button').forEach(btn => {
    if (btn.dataset.val === prefs.bubbleFrequency) btn.classList.add('active');
    btn.onclick = () => {
      seg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyPrefs({ bubbleFrequency: btn.dataset.val });
    };
  });
}

function setupThemeSeg(prefs) {
  const seg = document.getElementById('themeSeg');
  seg.querySelectorAll('button').forEach(btn => {
    if (btn.dataset.val === prefs.theme) btn.classList.add('active');
    btn.onclick = () => {
      seg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyPrefs({ theme: btn.dataset.val });
    };
  });
}

function setupTypingSpeed(prefs) {
  const slider = document.getElementById('typingSpeed');
  const label = document.getElementById('typingSpeedVal');
  slider.value = prefs.typingSpeed;
  label.textContent = `${prefs.typingSpeed} ms`;
  slider.oninput = () => {
    label.textContent = `${slider.value} ms`;
  };
  slider.onchange = () => {
    applyPrefs({ typingSpeed: Number(slider.value) });
  };
}

function setupPetScale(prefs) {
  const slider = document.getElementById('petScale');
  const label = document.getElementById('petScaleVal');
  slider.value = prefs.petScale;
  label.textContent = `${Math.round(prefs.petScale * 100)}%`;
  slider.oninput = () => {
    label.textContent = `${Math.round(slider.value * 100)}%`;
  };
  // 标记:上次 toast 时的 scale,避免 < 0.9 时反复弹同一提示
  let lastScaleForToast = prefs.petScale;
  slider.onchange = () => {
    const newScale = Number(slider.value);
    // 实时生效:renderer 收到 prefs-changed 立即调 setProperty + setBounds
    applyPrefs({ petScale: newScale });
    // < 0.9 时,❤️/✕ 按钮会被隐藏 —— 提示用户
    if (newScale < 0.9 && lastScaleForToast >= 0.9) {
      showToast('尺寸小于 90%,气泡的 ❤️/✕ 按钮会隐藏');
    }
    // 反过来(从 < 0.9 拉回 ≥ 0.9)也提示
    if (newScale >= 0.9 && lastScaleForToast < 0.9) {
      showToast('尺寸恢复 90% 以上,气泡 ❤️/✕ 按钮会重新出现');
    }
    lastScaleForToast = newScale;
  };
}

function setupToggle(id, prefs, key) {
  const el = document.getElementById(id);
  el.checked = !!prefs[key];
  el.onchange = () => {
    applyPrefs({ [key]: el.checked });
  };
}

function showToast(text) {
  const toast = document.createElement('div');
  toast.textContent = text;
  toast.style.cssText = `
    position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.85); color: #fff; padding: 8px 16px;
    border-radius: 6px; font-size: 12px; z-index: 9999;
    animation: fadeIn 0.2s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// 天气设置 —— v1.9.1
//  重点:不再"输入即保存",改成"展示定位 + 手动 override"
//  - 进入页面就拉一次 IP 定位,展示 city / regionName
//  - "重新定位"按钮可手动刷新
//  - "手动覆盖" 文本框失去焦点后才保存(降低写频率)
//  - "启用天气" 开关即保存
//  - 之前的 sendSync / onSettingsClosing 兜底都去掉 —— 因为我们不在关窗口时做特殊处理
async function setupWeather(prefs) {
  const cityInput = document.getElementById('weatherCity');
  const enabledCheckbox = document.getElementById('weatherEnabled');
  const locDisplay = document.getElementById('weatherLocDisplay');
  const relocateBtn = document.getElementById('weatherRelocateBtn');
  if (!cityInput || !enabledCheckbox || !locDisplay || !relocateBtn) {
    console.error('[weather] DOM elements missing');
    return;
  }
  const weather = (prefs && prefs.weather) || { city: '', enabled: true };
  cityInput.value = weather.city || '';
  enabledCheckbox.checked = weather.enabled !== false;

  // 显示当前定位
  function setLocDisplay(text, cls) {
    locDisplay.textContent = text;
    locDisplay.className = 'loc-display' + (cls ? ' ' + cls : '');
  }

  // 拉一次 IP 定位
  async function fetchAndShowLocation() {
    setLocDisplay('定位中...', 'loc-loading');
    relocateBtn.disabled = true;
    try {
      const r = await window.settingsAPI.getIpLocation();
      if (r && r.ok) {
        // 展示: 城市 + 地区
        const txt = `${r.country || ''} ${r.region || ''} ${r.city || ''}`.trim();
        setLocDisplay(txt || '定位成功但无城市', '');
        // 自动回填 city input —— 用户可以再覆盖
        if (!cityInput.value.trim()) {
          cityInput.value = r.city || '';
        }
        return r;
      } else {
        setLocDisplay('定位失败: ' + (r && r.reason || '?'), 'loc-error');
        return null;
      }
    } catch (e) {
      setLocDisplay('定位失败: ' + e.message, 'loc-error');
      return null;
    } finally {
      relocateBtn.disabled = false;
    }
  }

  // 进入页面:立即拉一次
  fetchAndShowLocation();

  // "重新定位"按钮
  relocateBtn.addEventListener('click', fetchAndShowLocation);

  // 手动覆盖城市:blur 时保存(避免每个字符写)
  cityInput.addEventListener('blur', async () => {
    const newCity = cityInput.value.trim();
    const r = await applyPrefs({ weather: { ...weather, city: newCity } });
    if (r && r.ok) {
      showToast(styleToast(newCity ? `已设置覆盖城市: ${newCity}` : '已清除,使用 IP 定位'));
    } else {
      showToast('保存失败');
    }
  });
  // Enter 键也保存
  cityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      cityInput.blur();
    }
  });

  // 启用开关
  enabledCheckbox.addEventListener('change', async () => {
    const r = await applyPrefs({
      weather: { ...weather, enabled: enabledCheckbox.checked },
    });
    if (r && r.ok) {
      showToast(styleToast(enabledCheckbox.checked ? '天气播报已开启' : '天气播报已关闭'));
    } else {
      showToast('保存失败');
    }
  });
}

// TTS 朗读设置 —— v1.11
//  启用开关 + 语速/音调 slider + 试听按钮
//  注: settings 窗口和主桌宠共享同一份 prefs, 改动立刻生效
function setupTTS(prefs) {
  // v1.11.5: TTS section 临时隐藏,如果被移走就跳过
  const section = document.getElementById('ttsSection');
  if (!section) return;
  const enabledEl = document.getElementById('ttsEnabled');
  const rateEl = document.getElementById('ttsRate');
  const rateLabel = document.getElementById('ttsRateLabel');
  const pitchEl = document.getElementById('ttsPitch');
  const pitchLabel = document.getElementById('ttsPitchLabel');
  const testBtn = document.getElementById('ttsTestBtn');
  const genderSeg = document.getElementById('ttsGenderSeg');
  const customRow = document.getElementById('ttsCustomRow');
  const customVoiceInput = document.getElementById('ttsCustomVoice');
  if (!enabledEl || !rateEl || !pitchEl || !testBtn) return;

  const tts = (prefs && prefs.tts) || { enabled: true, rate: 1.0, pitch: 1.0, volume: 1.0, voicePref: 'auto', customVoice: '' };

  enabledEl.checked = tts.enabled !== false;
  rateEl.value = tts.rate || 1.0;
  rateLabel.textContent = (tts.rate || 1.0).toFixed(1) + 'x';
  pitchEl.value = tts.pitch || 1.0;
  pitchLabel.textContent = (tts.pitch || 1.0).toFixed(1);

  // 声音偏好 segmented control
  if (genderSeg) {
    const btns = genderSeg.querySelectorAll('button');
    btns.forEach((btn) => {
      if (btn.dataset.val === (tts.voicePref || 'auto')) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    // 控制自定义行的显隐
    if (customRow) {
      customRow.hidden = (tts.voicePref || 'auto') !== 'custom';
    }
    if (customVoiceInput) {
      customVoiceInput.value = tts.customVoice || '';
    }
    genderSeg.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn || !btn.dataset || !btn.dataset.val) return;
      const newVal = btn.dataset.val;
      btns.forEach((b) => b.classList.toggle('active', b === btn));
      if (customRow) customRow.hidden = newVal !== 'custom';
      const r = await applyPrefs({ tts: { ...tts, voicePref: newVal } });
      if (r && r.ok) {
        const labelMap = { auto: '跟随性别', female: '女声', male: '男声', custom: '自定义' };
        showToast(styleToast(`声音: ${labelMap[newVal] || newVal}`));
      } else {
        showToast('保存失败');
      }
    });
  }

  // 自定义声音名
  if (customVoiceInput) {
    customVoiceInput.addEventListener('blur', async () => {
      const v = customVoiceInput.value.trim();
      const r = await applyPrefs({ tts: { ...tts, customVoice: v } });
      if (r && r.ok) {
        showToast(v ? `已设置声音名: ${v}` : '已清空自定义声音名');
      } else {
        showToast('保存失败');
      }
    });
    customVoiceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') customVoiceInput.blur();
    });
  }

  // 启用开关
  enabledEl.addEventListener('change', async () => {
    const r = await applyPrefs({ tts: { ...tts, enabled: enabledEl.checked } });
    if (r && r.ok) {
      showToast(styleToast(enabledEl.checked ? '朗读已开启' : '朗读已关闭'));
    } else {
      showToast('保存失败');
    }
  });

  // 语速 slider
  rateEl.addEventListener('input', () => {
    rateLabel.textContent = parseFloat(rateEl.value).toFixed(1) + 'x';
  });
  rateEl.addEventListener('change', async () => {
    const r = await applyPrefs({ tts: { ...tts, rate: parseFloat(rateEl.value) } });
    if (r && r && r.ok) {
      showToast('已保存');
    }
  });

  // 音调 slider
  pitchEl.addEventListener('input', () => {
    pitchLabel.textContent = parseFloat(pitchEl.value).toFixed(1);
  });
  pitchEl.addEventListener('change', async () => {
    const r = await applyPrefs({ tts: { ...tts, pitch: parseFloat(pitchEl.value) } });
    if (r && r && r.ok) {
      showToast('已保存');
    }
  });

  // 试听按钮 —— 用当前 tts 偏好选声
  testBtn.addEventListener('click', () => {
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
      const u = new SpeechSynthesisUtterance('你好,我是你的桌宠~今天心情怎么样?');
      const gender = (window._petProfile && window._petProfile.gender) || 'other';
      // 直接复刻 renderer 的选声逻辑(简化版)
      const voices = window.speechSynthesis.getVoices();
      const pref = tts.voicePref || 'auto';
      let v = null;
      if (pref === 'custom' && tts.customVoice && tts.customVoice.trim()) {
        const needle = tts.customVoice.trim().toLowerCase();
        v = voices.find(x => x.name.toLowerCase().includes(needle));
      }
      if (!v) {
        const forced = pref === 'female' ? 'female' : pref === 'male' ? 'male' : pref === 'other' ? 'other' : gender;
        let candidates;
        if (forced === 'male') {
          candidates = [/Microsoft Yunyang/i, /Microsoft Kangkang/i, /Microsoft Yunxi/i, /Sin-ji/i, /zh-CN/i];
        } else if (forced === 'other') {
          candidates = [/Microsoft Xiaoxiao/i, /Microsoft Yunyang/i, /zh-CN/i];
        } else {
          candidates = [/Microsoft Xiaoxiao/i, /Microsoft Yaoyao/i, /Microsoft Huihui/i, /Tingting/i, /Sin-ji/i, /zh-CN/i];
        }
        for (const re of candidates) {
          v = voices.find(x => re.test(x.name));
          if (v) break;
        }
        if (!v) v = voices.find(x => x.lang && x.lang.startsWith('zh')) || voices[0];
      }
      if (v) {
        u.voice = v;
        u.lang = v.lang || 'zh-CN';
      } else {
        u.lang = 'zh-CN';
      }
      u.rate = parseFloat(rateEl.value);
      u.pitch = parseFloat(pitchEl.value);
      u.volume = 1.0;
      window.speechSynthesis.speak(u);
    } else {
      showToast('当前环境不支持朗读');
    }
  });
}

function setupReset() {
  document.getElementById('resetBtn').onclick = async () => {
    if (!confirm('确定要重置所有数据吗？\n（包括统计、自定义金句、纪念日、学习评分）')) return;
    const res = await window.settingsAPI.resetAll();
    if (res.ok) {
      showToast('已重置,正在刷新...');
      setTimeout(() => location.reload(), 800);
    } else {
      showToast('重置失败: ' + (res.error || '?'));
    }
  };
}

// ============================================================
//  宠物档案 —— v1.8
// ============================================================
// 自定义下拉组件 —— 替换原生 select(避免 OS 弹层白底)
// 用法: const dd = makeDropdown('#petBirthMonth', { items: [...], value: '0', onChange: (v) => {} });
// items: [{ value, label, disabled? }] / value: 字符串 / onChange: 回调(value)
function makeDropdown(targetOrSelector, opts) {
  const target = typeof targetOrSelector === 'string' ? document.querySelector(targetOrSelector) : targetOrSelector;
  if (!target) return null;
  const items = opts.items || [];
  let value = opts.value != null ? String(opts.value) : '';
  const onChange = opts.onChange || (() => {});
  const placeholder = opts.placeholder || '';
  const width = opts.width || null;  // 字符串如 '80px'

  // 隐藏原 select(保留 DOM 状态)
  target.style.display = 'none';

  // 创建自定义下拉 DOM
  const wrap = document.createElement('div');
  wrap.className = 'dropdown';
  if (width) wrap.style.minWidth = width;

  const display = document.createElement('div');
  display.className = 'dropdown-display';
  const renderDisplay = () => {
    const found = items.find(it => String(it.value) === value);
    display.textContent = found ? found.label : (placeholder || '请选择');
  };
  renderDisplay();

  const list = document.createElement('div');
  list.className = 'dropdown-list';
  items.forEach(it => {
    const item = document.createElement('div');
    item.className = 'dropdown-item';
    if (it.disabled) item.classList.add('disabled');
    if (String(it.value) === value) item.classList.add('selected');
    item.textContent = it.label;
    item.dataset.value = String(it.value);
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (it.disabled) return;
      value = String(it.value);
      // 同步原 select(让 DOM 状态保持)
      target.value = value;
      // 触发原 select 的 change 事件(给已有代码用)
      target.dispatchEvent(new Event('change', { bubbles: true }));
      // 关闭
      wrap.classList.remove('open');
      // 重渲染选中态
      list.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      renderDisplay();
      onChange(value);
    });
    list.appendChild(item);
  });

  display.addEventListener('click', (e) => {
    e.stopPropagation();
    // 关闭其他 dropdown
    document.querySelectorAll('.dropdown.open').forEach(el => {
      if (el !== wrap) el.classList.remove('open');
    });
    wrap.classList.toggle('open');
  });
  // 点外部关闭
  document.addEventListener('click', () => wrap.classList.remove('open'));

  wrap.appendChild(display);
  wrap.appendChild(list);
  target.parentNode.insertBefore(wrap, target.nextSibling);

  return {
    el: wrap,
    getValue: () => value,
    setValue: (v) => {
      value = String(v);
      target.value = value;
      // 重渲染
      list.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('selected'));
      const found = items.find(it => String(it.value) === value);
      const itemEl = list.querySelector(`.dropdown-item[data-value="${CSS.escape(value)}"]`);
      if (itemEl) itemEl.classList.add('selected');
      renderDisplay();
    },
    refresh: (newItems, newValue) => {
      // 重建列表
      list.innerHTML = '';
      if (newItems) items.length = 0, items.push(...newItems);
      if (newValue != null) value = String(newValue);
      items.forEach(it => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        if (it.disabled) item.classList.add('disabled');
        if (String(it.value) === value) item.classList.add('selected');
        item.textContent = it.label;
        item.dataset.value = String(it.value);
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          if (it.disabled) return;
          value = String(it.value);
          target.value = value;
          target.dispatchEvent(new Event('change', { bubbles: true }));
          wrap.classList.remove('open');
          list.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('selected'));
          item.classList.add('selected');
          renderDisplay();
          onChange(value);
        });
        list.appendChild(item);
      });
      renderDisplay();
    },
  };
}

function getZodiacByDate(month, day) {
  const edges = [
    [3, 21, 4, 19, '白羊座'],
    [4, 20, 5, 20, '金牛座'],
    [5, 21, 6, 21, '双子座'],
    [6, 22, 7, 22, '巨蟹座'],
    [7, 23, 8, 22, '狮子座'],
    [8, 23, 9, 22, '处女座'],
    [9, 23, 10, 23, '天秤座'],
    [10, 24, 11, 22, '天蝎座'],
    [11, 23, 12, 21, '射手座'],
    [12, 22, 1, 19, '摩羯座'],
    [1, 20, 2, 18, '水瓶座'],
    [2, 19, 3, 20, '双鱼座'],
  ];
  for (const [m1, d1, m2, d2, name] of edges) {
    if (m1 === m2) {
      if (month === m1 && day >= d1 && day <= d2) return name;
    } else {
      if ((month === m1 && day >= d1) || (month === m2 && day <= d2)) return name;
    }
  }
  return '';
}

// ============================================================
//  v1.13 定时通知设置面板
// ============================================================
function setupNotifications(prefs) {
  const section = document.getElementById('notifSection');
  if (!section) return;
  const notif = (prefs && prefs.notifications) || { pomodoro: true, hydration: true, sedentary: true, workMin: 25, restMin: 5, hydrationMin: 60, sedentaryMin: 60 };

  // 3 个开关
  setupToggle('notifPomodoro', notif, 'pomodoro');
  setupToggle('notifHydration', notif, 'hydration');
  setupToggle('notifSedentary', notif, 'sedentary');

  // 4 个 slider
  const sliders = [
    { id: 'notifWorkMin',       key: 'workMin',       label: 'min' },
    { id: 'notifRestMin',       key: 'restMin',       label: 'min' },
    { id: 'notifHydrationMin',  key: 'hydrationMin',  label: 'min' },
    { id: 'notifSedentaryMin',  key: 'sedentaryMin',  label: 'min' },
  ];
  for (const s of sliders) {
    const el = document.getElementById(s.id);
    const labelEl = document.getElementById(s.id + 'Label');
    if (!el) continue;
    el.value = notif[s.key];
    if (labelEl) labelEl.textContent = el.value + ' ' + s.label;
    el.addEventListener('input', () => {
      if (labelEl) labelEl.textContent = el.value + ' ' + s.label;
    });
    el.addEventListener('change', async () => {
      const r = await applyPrefs({ notifications: { ...notif, [s.key]: Number(el.value) } });
      if (r && r.ok) showToast('已保存');
    });
  }

  // 同步 checkbox change —— applyPrefs 已经在 setupToggle 里挂好
  // 今日完成数显示
  const todayEl = document.getElementById('notifPomodoroToday');
  if (todayEl && window.settingsAPI && window.settingsAPI.notifPomodoroStatus) {
    window.settingsAPI.notifPomodoroStatus().then((s) => {
      if (todayEl && s) todayEl.textContent = `今日完成 ${s.todayCount} 个番茄`;
    }).catch(() => {});
  }

  // 开始番茄钟按钮
  const startBtn = document.getElementById('notifStartBtn');
  if (startBtn && window.settingsAPI && window.settingsAPI.notifPomodoroStatus) {
    // 按钮文字根据当前状态切换
    function updateStartBtn() {
      window.settingsAPI.notifPomodoroStatus().then((s) => {
        if (!s) return;
        if (s.active) {
          startBtn.textContent = '⏸ 停止番茄钟';
          startBtn.classList.remove('btn-primary');
          startBtn.classList.add('btn-ghost');
        } else {
          startBtn.textContent = '🍅 开始番茄钟';
          startBtn.classList.add('btn-primary');
          startBtn.classList.remove('btn-ghost');
        }
        if (todayEl) todayEl.textContent = `今日完成 ${s.todayCount} 个番茄${s.active ? `,${s.phase === 'working' ? '🍅' : '☕'}还剩 ${s.remainMin} 分钟` : ''}`;
      }).catch(() => {});
    }
    updateStartBtn();
    // v1.13.1: 监听主进程推送的通知,实时刷新按钮状态(避免 30s 延迟)
    if (window.settingsAPI.onNotification) {
      window.settingsAPI.onNotification((data) => {
        if (data && (data.type === 'pomodoro-started' || data.type === 'pomodoro-stopped' || data.type === 'pomodoro-rest-start' || data.type === 'pomodoro-work-start' || data.type === 'pomodoro-status' || data.type === 'hydration-ack' || data.type === 'sedentary-ack')) {
          updateStartBtn();
        }
      });
    }
    startBtn.addEventListener('click', async () => {
      const s = await window.settingsAPI.notifPomodoroStatus();
      if (s && s.active) {
        await window.settingsAPI.notifStopPomodoro();
        showToast('番茄钟已停止');
      } else {
        await window.settingsAPI.notifStartPomodoro();
        showToast('🍅 番茄钟开始,加油!');
      }
      // 不要立即 updateStartBtn —— 等 onNotification 推送后再更新(更实时)
    });
    // 兜底:定时刷新按钮状态(每 30s),防止 onNotification 漏推
    setInterval(updateStartBtn, 30000);
  }
}

function setupProfile(profile) {
  profile = profile || {};
  // 原始值(用于取消回滚)
  const original = {
    name: profile.name || '',
    birthday: {
      month: (profile.birthday && profile.birthday.month) || 0,
      day: (profile.birthday && profile.birthday.day) || 0,
    },
    zodiac: profile.zodiac || '',
    gender: profile.gender || 'female',
    mbti: profile.mbti || '',
  };
  // 当前工作副本(编辑期间在内存中累积,点保存才落盘)
  const current = JSON.parse(JSON.stringify(original));
  let isEditing = false;

  // 字段 DOM 引用
  const nameInput = document.getElementById('petName');
  const editBtn = document.getElementById('profileEdit');
  const saveBtn = document.getElementById('profileSave');
  const cancelBtn = document.getElementById('profileCancel');
  const resetBtn = document.getElementById('profileReset');
  const dirtyHint = document.getElementById('profileDirtyHint');

  // 初始化 UI 到 current 值
  function syncFromCurrent() {
    nameInput.value = current.name;
    if (monthDD) monthDD.setValue(String(current.birthday.month || 0));
    if (dayDD) dayDD.setValue(String(current.birthday.day || 0));
    if (zodiacDD) zodiacDD.setValue(current.zodiac);
    genderSeg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.val === current.gender);
    });
    if (mbtiDD) mbtiDD.setValue(current.mbti);
  }

  function isDirty() {
    return JSON.stringify(current) !== JSON.stringify(original);
  }

  function refreshButtons() {
    const dirty = isDirty();
    if (isEditing) {
      editBtn.hidden = true;
      saveBtn.hidden = false;
      cancelBtn.hidden = false;
      dirtyHint.hidden = !dirty;
      saveBtn.disabled = !dirty;  // 没改动时不能点保存
    } else {
      editBtn.hidden = false;
      saveBtn.hidden = true;
      cancelBtn.hidden = true;
      dirtyHint.hidden = true;  // 非编辑态不显示提示
    }
  }

  function setEditing(v) {
    isEditing = v;
    nameInput.disabled = !v;
    // dropdown 也需要锁——通过 wrapper 加 class
    if (monthDD) monthDD.el.style.pointerEvents = v ? '' : 'none';
    if (dayDD) dayDD.el.style.pointerEvents = v ? '' : 'none';
    if (zodiacDD) zodiacDD.el.style.pointerEvents = v ? '' : 'none';
    if (mbtiDD) mbtiDD.el.style.pointerEvents = v ? '' : 'none';
    // 视觉:非编辑态给所有输入半透明 + not-allowed 光标
    [nameInput, monthDD && monthDD.el, dayDD && dayDD.el, zodiacDD && zodiacDD.el, mbtiDD && mbtiDD.el].forEach(el => {
      if (!el) return;
      el.classList.toggle('locked', !v);
    });
    if (genderSeg) {
      genderSeg.style.opacity = v ? '1' : '0.55';
      genderSeg.style.pointerEvents = v ? '' : 'none';
    }
    refreshButtons();
  }

  // 姓名 —— 改时更新 current
  nameInput.value = current.name;
  // label 区域点击 → focus input(让"姓名"label 也能触发 focus)
  const nameLabel = nameInput.closest('.setting-row').querySelector('.setting-label');
  if (nameLabel) {
    nameLabel.style.cursor = 'text';
    nameLabel.addEventListener('mousedown', (e) => {
      if (!isEditing) {
        e.preventDefault();
        showToast('请先点"编辑"按钮');
        return;
      }
      // 编辑态:点 label 直接 focus 到 input
      setTimeout(() => nameInput.focus(), 0);
    });
  }
  // 主动捕 mousedown 强制 focus(防止 CSS :focus 在 Win32 下不触发 box-shadow)
  nameInput.addEventListener('mousedown', (e) => {
    if (!isEditing) {
      e.preventDefault();
      showToast('请先点"编辑"按钮');
      return;
    }
    setTimeout(() => {
      nameInput.focus();
      // 手动加 .is-focused class(防止 CSS :focus 在 Win32 下不触发)
      nameInput.classList.add('is-focused');
    }, 0);
  });
  // blur 时移除 .is-focused
  nameInput.addEventListener('blur', () => {
    nameInput.classList.remove('is-focused');
  });
  nameInput.addEventListener('input', () => {
    if (!isEditing) return;
    current.name = nameInput.value.trim();
    refreshButtons();
  });

  // 月份下拉
  const monthItems = [{ value: '0', label: '月' }];
  for (let m = 1; m <= 12; m++) monthItems.push({ value: String(m), label: m + '月' });
  const dayItems = [{ value: '0', label: '日' }];
  for (let d = 1; d <= 31; d++) dayItems.push({ value: String(d), label: d + '日' });
  const zodiacItems = [{ value: '', label: '未设置' }];
  ['白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座','水瓶座','双鱼座']
    .forEach(z => zodiacItems.push({ value: z, label: z }));
  const mbtiItems = [{ value: '', label: '未设置' }];
  ['ISTJ','ISFJ','INFJ','INTJ','ISTP','ISFP','INFP','INTP','ESTP','ESFP','ENFP','ENTP','ESTJ','ESFJ','ENFJ','ENTJ']
    .forEach(m => mbtiItems.push({ value: m, label: m }));

  const monthSel = document.getElementById('petBirthMonth');
  const daySel = document.getElementById('petBirthDay');
  const zodiacSel = document.getElementById('petZodiac');
  const mbtiSel = document.getElementById('petMbti');

  let zodiacDD = null, dayDD = null, mbtiDD = null;
  const monthDD = makeDropdown(monthSel, {
    items: monthItems,
    value: String(current.birthday.month || 0),
    width: '60px',
    onChange: (v) => {
      if (!isEditing) return;
      current.birthday.month = parseInt(v, 10);
      // 自动推导星座(只在有完整生日时)
      if (current.birthday.month > 0 && current.birthday.day > 0) {
        const z = getZodiacByDate(current.birthday.month, current.birthday.day);
        if (z && zodiacDD) {
          current.zodiac = z;
          zodiacDD.setValue(z);
        }
      }
      refreshButtons();
    },
  });
  dayDD = makeDropdown(daySel, {
    items: dayItems,
    value: String(current.birthday.day || 0),
    width: '60px',
    onChange: (v) => {
      if (!isEditing) return;
      current.birthday.day = parseInt(v, 10);
      if (current.birthday.month > 0 && current.birthday.day > 0) {
        const z = getZodiacByDate(current.birthday.month, current.birthday.day);
        if (z && zodiacDD) {
          current.zodiac = z;
          zodiacDD.setValue(z);
        }
      }
      refreshButtons();
    },
  });
  zodiacDD = makeDropdown(zodiacSel, {
    items: zodiacItems,
    value: current.zodiac,
    width: '90px',
    onChange: (v) => {
      if (!isEditing) return;
      current.zodiac = v;
      refreshButtons();
    },
  });
  mbtiDD = makeDropdown(mbtiSel, {
    items: mbtiItems,
    value: current.mbti,
    width: '70px',
    onChange: (v) => {
      if (!isEditing) return;
      current.mbti = v;
      refreshButtons();
    },
  });

  // 性别
  const genderSeg = document.getElementById('petGenderSeg');
  genderSeg.querySelectorAll('button').forEach(btn => {
    if (btn.dataset.val === current.gender) btn.classList.add('active');
    btn.onclick = () => {
      if (!isEditing) return;
      genderSeg.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      current.gender = btn.dataset.val;
      refreshButtons();
    };
  });

  // ============================================================
  // 4 个按钮
  // ============================================================
  editBtn.onclick = () => {
    // 关键:进入编辑前先 blur,清除 IME 残留状态(重置后 IME 卡住导致 Process key)
    try { nameInput.blur(); } catch (e) {}
    setEditing(true);
    showToast('进入编辑模式');
    // 主动 focus 姓名 input —— 反复 focus 确保抢到键盘焦点
    const tryFocus = (attempt) => {
      nameInput.focus();
      if (document.activeElement === nameInput) {
        // focus 成功:手动加 .is-focused class(避免 CSS :focus 在 Win32 下不触发)
        nameInput.classList.add('is-focused');
      }
      if (document.activeElement !== nameInput && attempt < 5) {
        requestAnimationFrame(() => tryFocus(attempt + 1));
      }
    };
    requestAnimationFrame(() => tryFocus(1));
  };
  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    try {
      const payload = {
        name: current.name,
        birthday: { month: current.birthday.month, day: current.birthday.day },
        zodiac: current.zodiac,
        gender: current.gender,
        mbti: current.mbti,
      };
      const res = await applyProfile(payload);
      if (res && res.ok) {
        // 落盘成功 → 把 original 同步到 current
        Object.assign(original, current);
        if (original.birthday) original.birthday = { ...current.birthday };
        setEditing(false);
        showToast(styleToast(current.name ? `【${current.name}】档案已保存` : '档案已保存'));
      } else {
        showToast('保存失败: ' + (res && res.error || '?'));
        saveBtn.disabled = false;
      }
    } catch (e) {
      showToast('保存失败: ' + e.message);
      saveBtn.disabled = false;
    }
  };
  cancelBtn.onclick = () => {
    // 取消:回滚 current 到 original
    Object.assign(current, JSON.parse(JSON.stringify(original)));
    syncFromCurrent();
    setEditing(false);
    showToast(styleToast('已取消修改'));
  };
  resetBtn.onclick = async () => {
    if (!confirm('确定要重置【宠物档案】吗？\n（姓名/生日/星座/性别/MBTI 全部清空）')) return;
    try {
      const res = await applyProfile({
        name: '',
        birthday: { month: 0, day: 0 },
        zodiac: '',
        gender: 'female',
        mbti: '',
      });
      if (res && res.ok) {
        // 重置后:把 original 也清空,current 同步
        original.name = '';
        original.birthday = { month: 0, day: 0 };
        original.zodiac = '';
        original.gender = 'female';
        original.mbti = '';
        Object.assign(current, JSON.parse(JSON.stringify(original)));
        syncFromCurrent();
        setEditing(false);
        // 关键:重置后让 settings 窗口 self-blur+focus,强制 Chromium 重置 IME 状态
        // (Win32 transparent 父窗口下,从有 value 变空会让 IME 状态卡住)
        try { window.settingsAPI.resetWindowFocus(); } catch (e) {}
        showToast(styleToast('档案已重置'));
      } else {
        showToast('重置失败: ' + (res && res.error || '?'));
      }
    } catch (e) {
      showToast('重置失败: ' + e.message);
    }
  };

  // 初始状态:不在编辑模式
  syncFromCurrent();
  setEditing(false);
}

// ============================================================
//  Init
// ============================================================
(async function init() {
  try {
    const { prefs, stats, skinInfo, profile } = await loadAll();
    renderStats(stats);
    renderLevel(stats);
    renderSkinPreview(skinInfo);
    setupFreqSeg(prefs);
    setupThemeSeg(prefs);
    setupTypingSpeed(prefs);
    setupPetScale(prefs);
    setupToggle('autoLaunch', prefs, 'autoLaunch');
    setupToggle('rememberPosition', prefs, 'rememberPosition');
    setupProfile(profile);
    setupWeather(prefs);
    setupTTS(prefs);
    setupNotifications(prefs);
    setupReset();
  } catch (e) {
    console.error('settings init failed:', e);
    document.body.innerHTML = '<div style="padding:40px;color:#ff8888;">加载失败: ' + e.message + '</div>';
  }
})();
