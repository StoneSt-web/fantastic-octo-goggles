// preload for settings window —— 暴露设置相关的 IPC
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  getPrefs: () => ipcRenderer.invoke('pet:get-prefs'),
  setPrefs: (prefs) => ipcRenderer.invoke('pet:set-prefs', prefs),
  getStats: () => ipcRenderer.invoke('pet:stat', 'get'),
  getSkin: () => ipcRenderer.invoke('pet:get-skin'),
  // 重置 settings.json(把整文件 unlink,主进程会重写默认)
  resetAll: () => ipcRenderer.invoke('pet:reset-all'),
  // 宠物档案 —— v1.8 新增
  getProfile: () => ipcRenderer.invoke('pet:get-profile'),
  setProfile: (profile) => ipcRenderer.invoke('pet:set-profile', profile),
  // 监听档案变化(其他窗口改完 pet:profile-changed 后,这里也会收到)
  onProfileChanged: (cb) => {
    ipcRenderer.on('pet:profile-changed', (_e, profile) => cb(profile));
  },
  // settings 窗口自触发 blur/focus 循环(修复重置后 input 不接收字符)
  resetWindowFocus: () => ipcRenderer.invoke('pet:reset-window-focus'),
  // IP 定位 —— v1.9.1 (settings 窗口需要这个)
  getIpLocation: () => ipcRenderer.invoke('pet:get-ip-location'),
  // v1.13 定时通知
  notifStartPomodoro: () => ipcRenderer.invoke('pet:notif-start-pomodoro'),
  notifStopPomodoro: () => ipcRenderer.invoke('pet:notif-stop-pomodoro'),
  notifPomodoroStatus: () => ipcRenderer.invoke('pet:notif-pomodoro-status'),
  // v1.13.1: 监听通知事件(实时刷新番茄钟按钮)
  onNotification: (cb) => {
    ipcRenderer.on('pet:notification', (_e, data) => cb(data));
  },
});
