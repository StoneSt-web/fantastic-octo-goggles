// 持久化设置：当前皮肤 + 互动统计 + 用户偏好 + 系统设置
const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '..', 'settings.json');

const DEFAULT_SETTINGS = {
  activeSkin: '阳光天使',
  // 互动统计 —— 用于等级/称号系统
  stats: {
    totalClicks: 0,        // 总点击数
    totalDrags: 0,         // 拖动次数
    totalBubbles: 0,       // 气泡显示次数
    firstLaunchAt: null,   // 首次启动时间戳(ms)
    lastActiveAt: null,    // 上次活跃时间戳
    activeDays: 0,         // 累计活跃天数
  },
  // 用户自定义金句 —— 加到气泡候选池
  customLines: [],
  // 纪念日 —— { month, day, label, advance } (advance=true 提前1天提醒)
  anniversaries: [],
  // 气泡反馈评分(用户 ❤️/✕ 气泡) —— text -> score (越低越少出现)
  bubbleRatings: {},

  // ============================================================
  //  用户偏好(基础设置) —— v1.7 新增
  // ============================================================
  bubbleFrequency: 'normal',   // low / normal / high —— 闲置多久出一个气泡
  typingSpeed: 65,             // ms/字 —— 气泡打字机速度(30-150)
  theme: 'mayday',             // 气泡词库:mayday / default / classical

  // ============================================================
  //  系统设置(程序行为) —— v1.7 新增
  // ============================================================
  autoLaunch: false,           // 开机自启
  rememberPosition: true,      // 记住窗口位置
  petScale: 1.2,               // 桌宠缩放(0.8 - 1.2) —— v1.7 默认 120%
  // 窗口位置(rememberPosition=true 时使用)
  windowPos: { x: null, y: null },

// ============================================================
  //  宠物档案 —�?v1.8 新增(拟人化基础)
  // ============================================================
  petProfile: {
    name: '',                       // 1-10�?空表示未设置,沿用"桌宠"称谓)
    birthday: { month: 0, day: 0 }, // 公历生日(0/0 表示未设�?)
    zodiac: '',                     // 12 星座(从生日自动推,也可手�?)
    gender: 'female',               // female / male / other
    mbti: '',                       // 16 �?1(空表示未设置)
    birthdayAt: null,               // 首次设置生日的时间戳(用于周年纪念)
  },

  // ============================================================
  //  天气 —�?v1.9 新增(启动问候+播报今日天气)
  // ============================================================
  weather: {
    city: '',                       // 城市名(中文/英文都可,空 = wttr.in 按 IP 定位)
    enabled: true,                  // 总开关
  },

  // ============================================================
  //  TTS 朗读 —�?v1.11 新增(气泡自动朗读)
  // ============================================================
  tts: {
    enabled: true,                  // 总开关
    rate: 1.0,                      // 语速 0.5-2.0
    pitch: 1.0,                     // 音调 0-2
    volume: 1.0,                    // 音量 0-1
    voicePref: 'auto',              // v1.11.5: 声音偏好:auto/female/male/custom
    customVoice: '',                 // v1.11.5: 自定义声音名(Yunyang / Xiaoxiao 等)
  },
  // ============================================================
  //  定时通知 —— v1.13 新增(番茄钟 + 喝水 + 久坐)
  // ============================================================
  notifications: {
    pomodoro: true,        // 番茄钟总开关
    hydration: true,       // 喝水提醒总开关
    sedentary: true,       // 久坐提醒总开关
    workMin: 25,           // 番茄工作时长(15-60)
    restMin: 5,            // 番茄休息时长(3-15)
    hydrationMin: 60,      // 喝水间隔(30-180)
    sedentaryMin: 60,      // 久坐间隔(30-180)
  },
};

function read() {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return {
      ...DEFAULT_SETTINGS,
      stats: { ...DEFAULT_SETTINGS.stats },
      windowPos: { ...DEFAULT_SETTINGS.windowPos },
      petProfile: { ...DEFAULT_SETTINGS.petProfile, birthday: { ...DEFAULT_SETTINGS.petProfile.birthday } },
    };
  }
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    // 合并时保证嵌套对象不缺失字段(版本升级时)
    const merged = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      stats: { ...DEFAULT_SETTINGS.stats, ...(parsed.stats || {}) },
      windowPos: { ...DEFAULT_SETTINGS.windowPos, ...(parsed.windowPos || {}) },
      petProfile: {
        ...DEFAULT_SETTINGS.petProfile,
        ...(parsed.petProfile || {}),
        birthday: { ...DEFAULT_SETTINGS.petProfile.birthday, ...((parsed.petProfile && parsed.petProfile.birthday) || {}) },
      },
      weather: { ...DEFAULT_SETTINGS.weather, ...(parsed.weather || {}) },
    };
    // v1.7 迁移:之前默认 petScale=1.0,新默认 1.2;老用户升级时直接拉到 1.2
    if (parsed.petScale === 1.0 || parsed.petScale === 1) {
      merged.petScale = DEFAULT_SETTINGS.petScale;
    }
    return merged;
  } catch (e) {
    console.error('settings read error, using defaults:', e.message);
    return {
      ...DEFAULT_SETTINGS,
      stats: { ...DEFAULT_SETTINGS.stats },
      windowPos: { ...DEFAULT_SETTINGS.windowPos },
      petProfile: { ...DEFAULT_SETTINGS.petProfile, birthday: { ...DEFAULT_SETTINGS.petProfile.birthday } },
      weather: { ...DEFAULT_SETTINGS.weather },
    };
  }
}

function write(settings) {
  const merged = { ...read(), ...settings };
  if (settings.stats) {
    merged.stats = { ...merged.stats, ...settings.stats };
  }
  if (settings.customLines !== undefined) {
    merged.customLines = settings.customLines;
  }
  if (settings.anniversaries !== undefined) {
    merged.anniversaries = settings.anniversaries;
  }
  if (settings.bubbleRatings !== undefined) {
    merged.bubbleRatings = settings.bubbleRatings;
  }
  if (settings.windowPos) {
    merged.windowPos = { ...merged.windowPos, ...settings.windowPos };
  }
  if (settings.petProfile) {
    merged.petProfile = { ...merged.petProfile, ...settings.petProfile };
    if (settings.petProfile.birthday) {
      merged.petProfile.birthday = { ...merged.petProfile.birthday, ...settings.petProfile.birthday };
    }
  }
  if (settings.weather) {
    merged.weather = { ...merged.weather, ...settings.weather };
  }
  if (settings.notifications) {
    merged.notifications = { ...merged.notifications, ...settings.notifications };
  }
  if (settings.tts) {
    merged.tts = { ...merged.tts, ...settings.tts };
    // 限制 voicePref 取值
    if (!['auto', 'female', 'male', 'custom'].includes(merged.tts.voicePref)) {
      merged.tts.voicePref = 'auto';
    }
    if (typeof merged.tts.customVoice !== 'string') {
      merged.tts.customVoice = '';
    }
  }
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2));
  return merged;
}

// stat() helper —— 给 main.js 的 pet:stat handler 用
function stat(op) {
  const cur = read();
  const stats = cur.stats || {};
  if (op === 'get') return stats;
  if (op === 'init' && !stats.firstLaunchAt) stats.firstLaunchAt = Date.now();
  if (['click', 'drag', 'bubble'].includes(op)) {
    const key = op === 'click' ? 'totalClicks' : op === 'drag' ? 'totalDrags' : 'totalBubbles';
    stats[key] = (stats[key] || 0) + 1;
  }
  stats.lastActiveAt = Date.now();
  if (op === 'activeDay') stats.activeDays = (stats.activeDays || 0) + 1;
  return write({ stats });
}

module.exports = { read, write, stat, SETTINGS_PATH, DEFAULT_SETTINGS };
