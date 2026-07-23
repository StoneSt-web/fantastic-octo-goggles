// v1.13 定时通知调度器 —— 番茄钟 + 喝水 + 久坐
// 在主进程跑,每 30s tick 一次,到点通过 pet:notification 事件推给 renderer
//
// 番茄钟状态机:
//   idle -> working(workMin) -> resting(restMin) -> working -> ... -> idle
//   用户主动 start / stop 切换
//
// 喝水/久坐: 纯定时,到点推通知 + 自动重置计时

let petWindow = null;  // 注入
let settingsWindow = null;  // 注入(用于实时刷新设置面板)
let settings = null;   // 注入

// 运行时状态(不存 settings)
const state = {
  pomodoro: {
    active: false,
    phase: 'idle',         // 'idle' | 'working' | 'resting'
    phaseStartAt: 0,       // 当前 phase 开始时间
    todayCount: 0,         // 今日完成番茄数(working→resting 完成一次)
    todayDate: '',         // 'YYYY-MM-DD' 今日日期,跨天重置
  },
  hydration: {
    lastAckAt: 0,          // 上次"我喝了"时间(ms)
  },
  sedentary: {
    lastAckAt: 0,          // 上次"我起来活动"时间(ms)
  },
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pushNotif(type, text, extra) {
  if (!petWindow || petWindow.isDestroyed()) return;
  console.log('[notifications] push:', type, '-', text);
  const payload = { type, text, ts: Date.now(), ...(extra || {}) };
  petWindow.webContents.send('pet:notification', payload);
  // v1.13.1: 同时推给 settingsWindow(如果开着),让设置面板的番茄钟按钮实时刷新
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('pet:notification', payload);
  }
}

/**
 * 重置今日状态(跨天或启动时)
 */
function rolloverIfNeeded() {
  const today = todayStr();
  if (state.pomodoro.todayDate !== today) {
    state.pomodoro.todayDate = today;
    state.pomodoro.todayCount = 0;
    state.hydration.lastAckAt = Date.now();
    state.sedentary.lastAckAt = Date.now();
  }
}

/**
 * 单次 tick(主进程每 30s 调一次)
 */
function tick() {
  rolloverIfNeeded();
  const cfg = settings.read().notifications || {};
  const now = Date.now();

  // 番茄钟
  if (state.pomodoro.active) {
    if (state.pomodoro.phase === 'working') {
      const elapsed = (now - state.pomodoro.phaseStartAt) / 1000 / 60;
      if (elapsed >= (cfg.workMin || 25)) {
        // 切到 resting
        state.pomodoro.phase = 'resting';
        state.pomodoro.phaseStartAt = now;
        state.pomodoro.todayCount += 1;
        pushNotif('pomodoro-rest-start', '休息一下~', { todayCount: state.pomodoro.todayCount });
      } else {
        // 状态更新(只在分钟变化时推,减少打扰)
        const remainMin = Math.ceil((cfg.workMin || 25) - elapsed);
        pushNotif('pomodoro-status', `🍅 工作中,还剩 ${remainMin} 分钟`, { remainMin, phase: 'working' });
      }
    } else if (state.pomodoro.phase === 'resting') {
      const elapsed = (now - state.pomodoro.phaseStartAt) / 1000 / 60;
      if (elapsed >= (cfg.restMin || 5)) {
        // 切回 working
        state.pomodoro.phase = 'working';
        state.pomodoro.phaseStartAt = now;
        pushNotif('pomodoro-work-start', '该工作啦~', {});
      } else {
        const remainMin = Math.ceil((cfg.restMin || 5) - elapsed);
        pushNotif('pomodoro-status', `☕ 休息中,还剩 ${remainMin} 分钟`, { remainMin, phase: 'resting' });
      }
    }
  }

  // 喝水
  if (cfg.hydration !== false) {
    const elapsed = (now - state.hydration.lastAckAt) / 1000 / 60;
    if (elapsed >= (cfg.hydrationMin || 60)) {
      pushNotif('hydration', '该喝水啦~ 保持水分哦 💧', {});
    }
  }

  // 久坐
  if (cfg.sedentary !== false) {
    const elapsed = (now - state.sedentary.lastAckAt) / 1000 / 60;
    if (elapsed >= (cfg.sedentaryMin || 60)) {
      pushNotif('sedentary', '坐了挺久了,起来动一动吧 🪑', {});
    }
  }
}

/**
 * 启动 scheduler(主进程 app.whenReady 后调)
 */
function start(opts) {
  petWindow = opts.petWindow;
  settingsWindow = opts.settingsWindow || null;
  settings = opts.settings;
  // 首次启动:如果 lastAckAt 是 0(未初始化),初始化为 now,避免立即触发
  if (state.hydration.lastAckAt === 0) state.hydration.lastAckAt = Date.now();
  if (state.sedentary.lastAckAt === 0) state.sedentary.lastAckAt = Date.now();
  rolloverIfNeeded();
  // 立即跑一次,然后每 30s
  tick();
  setInterval(tick, 30 * 1000);
  console.log('[notifications] scheduler started');
}

function startPomodoro() {
  if (state.pomodoro.active) return { ok: false, error: 'already active' };
  rolloverIfNeeded();
  state.pomodoro.active = true;
  state.pomodoro.phase = 'working';
  state.pomodoro.phaseStartAt = Date.now();
  pushNotif('pomodoro-started', '🍅 番茄钟开始,加油!', {});
  return { ok: true };
}

function stopPomodoro() {
  if (!state.pomodoro.active) return { ok: false, error: 'not active' };
  state.pomodoro.active = false;
  state.pomodoro.phase = 'idle';
  state.pomodoro.phaseStartAt = 0;
  pushNotif('pomodoro-stopped', '番茄钟已停止', {});
  return { ok: true };
}

function getPomodoroStatus() {
  const cfg = settings.read().notifications || {};
  let remainMin = 0;
  if (state.pomodoro.active && state.pomodoro.phase !== 'idle') {
    const elapsed = (Date.now() - state.pomodoro.phaseStartAt) / 1000 / 60;
    const total = state.pomodoro.phase === 'working' ? (cfg.workMin || 25) : (cfg.restMin || 5);
    remainMin = Math.max(0, Math.ceil(total - elapsed));
  }
  return {
    active: state.pomodoro.active,
    phase: state.pomodoro.phase,
    remainMin,
    todayCount: state.pomodoro.todayCount,
  };
}

function ackHydration() {
  state.hydration.lastAckAt = Date.now();
  // v1.13.1: 推一个 ack 通知(settings 窗口实时刷新 + renderer 端可视化)
  pushNotif('hydration-ack', '已记录喝水 💧', {});
  return { ok: true };
}

function ackSedentary() {
  state.sedentary.lastAckAt = Date.now();
  pushNotif('sedentary-ack', '已记录活动 🪑', {});
  return { ok: true };
}

module.exports = {
  start,
  startPomodoro,
  stopPomodoro,
  getPomodoroStatus,
  ackHydration,
  ackSedentary,
  setSettingsWindow: (w) => { settingsWindow = w; },
};