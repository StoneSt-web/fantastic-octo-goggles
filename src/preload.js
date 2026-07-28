// preload：通过 contextBridge 把受限的 API 暴露给渲染层
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  move: (dx, dy) => ipcRenderer.invoke('pet:move', dx, dy),
  resizeWindow: (scale) => ipcRenderer.invoke('pet:resize-window', scale),
  setIgnoreMouse: (ignore) => ipcRenderer.invoke('pet:set-ignore-mouse', ignore),
  quit: () => ipcRenderer.invoke('pet:quit'),
  showMenu: (x, y) => ipcRenderer.invoke('pet:show-menu', { x, y }),
  // 切换皮肤（主进程 bake + 推送新 frames 数据 + renderer 不需要 reload）
  switchSkin: (skinId) => ipcRenderer.invoke('pet:switch-skin', skinId),
  getSkin: () => ipcRenderer.invoke('pet:get-skin'),
  // 互动统计:get / init / click / drag / bubble / activeDay
  stat: (op) => ipcRenderer.invoke('pet:stat', op),
  // 自定义金句:get / add / remove
  customLines: (op, line) => ipcRenderer.invoke('pet:custom-lines', op, line),
  // 纪念日:get / add / remove
  anniversaries: (op, data) => ipcRenderer.invoke('pet:anniversaries', op, data),
  // 安装自定义皮肤(拖 PNG 进窗口)
  installSkin: (data) => ipcRenderer.invoke('pet:install-skin', data),
  // 气泡反馈: 喜欢/不喜欢
  bubbleFeedback: (text, isLike) => ipcRenderer.invoke('pet:bubble-feedback', text, isLike),
  // 监听主进程通知（菜单点击）
  onMenuAction: (callback) => {
    ipcRenderer.on('pet:menu-action', (_e, action) => callback(action));
  },
  // 监听皮肤切换事件（主进程推送新 frames 内容）
  onSkinChanged: (callback) => {
    ipcRenderer.on('pet:skin-changed', (_e, data) => callback(data));
  },
  // 鼠标互动 v1.10: 凑近 / 歪头 / 悬停 / 躲避
  onApproach: (callback) => {
    ipcRenderer.on('pet:approach', (_e, data) => callback(data));
  },
  onNearTilt: (callback) => {
    ipcRenderer.on('pet:near-tilt', () => callback());
  },
  onPetHover: (callback) => {
    ipcRenderer.on('pet:hover', () => callback());
  },
  onPetHoverLeave: (callback) => {
    ipcRenderer.on('pet:hover-leave', () => callback());
  },
  // 桌宠躲避鼠标
  dodge: () => ipcRenderer.invoke('pet:dodge'),
  // 监听设置变更（设置窗口改完 prefs 后,主进程广播）
  onPrefsChanged: (callback) => {
    ipcRenderer.on('pet:prefs-changed', (_e, prefs) => callback(prefs));
  },
  // 读 user prefs（启动时拉一次）
  getPrefs: () => ipcRenderer.invoke('pet:get-prefs'),
  // 宠物档案: name / birthday / zodiac / gender / mbti —— v1.8
  getProfile: () => ipcRenderer.invoke('pet:get-profile'),
  // 监听档案变化(设置窗口保存后,主进程广播)
  onProfileChanged: (callback) => {
    ipcRenderer.on('pet:profile-changed', (_e, profile) => callback(profile));
  },
  // 天气 —— v1.9
  // location 为空时 wttr.in 按 IP 自动定位
  getWeather: (location) => ipcRenderer.invoke('pet:get-weather', location),
  // IP 定位 —— v1.9.1 自动获取当前所在地
  getIpLocation: () => ipcRenderer.invoke('pet:get-ip-location'),
  // v1.0.3: TTS 已禁用,移除 expose
  // ttsSpeak: (text, opts) => ipcRenderer.invoke('pet:tts-speak', text, opts || {}),
  // ttsListVoices: () => ipcRenderer.invoke('pet:tts-list-voices'),
  // v1.13 定时通知(番茄钟/喝水/久坐)
  notifStartPomodoro: () => ipcRenderer.invoke('pet:notif-start-pomodoro'),
  notifStopPomodoro: () => ipcRenderer.invoke('pet:notif-stop-pomodoro'),
  notifPomodoroStatus: () => ipcRenderer.invoke('pet:notif-pomodoro-status'),
  notifAckHydration: () => ipcRenderer.invoke('pet:notif-ack-hydration'),
  notifAckSedentary: () => ipcRenderer.invoke('pet:notif-ack-sedentary'),
  // 监听主进程推送的通知
  onNotification: (callback) => {
    ipcRenderer.on('pet:notification', (_e, data) => callback(data));
  },
});