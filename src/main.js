// 主进程：透明置顶无边框窗口 + 系统托盘 + 多皮肤切换
//
// 关键设计：
//   - frame: false / transparent: true / alwaysOnTop: 'floating' / skipTaskbar: true
//   - 切皮肤不 reload：bake frames-embed.js 后 IPC 推送,renderer eval 更新
//   - 退出有 bye 动画：webContents.send('pet:menu-action', 'bye') 后延迟 1200ms app.quit()
const { app, BrowserWindow, ipcMain, screen, Menu, Tray, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const settings = require('../scripts/settings');
const { listSkins, applySkin, bake } = require('../scripts/bake-png');

let petWindow = null;
let tray = null;
// 标记：用户是否主动"退出"（区分"关闭窗口"和"退出应用"）
let isQuitting = false;
let activeSkinId = settings.read().activeSkin;
// v1.9.1 兼容旧名字: 死神倔强卜 → 倔强死神
if (activeSkinId === '死神倔强卜') {
  activeSkinId = '倔强死神';
  settings.write({ activeSkin: activeSkinId });
  console.log('[main] migrated activeSkin 死神倔强卜 → 倔强死神');
}
// 校验 activeSkinId 存在(防用户手动改了 settings.json 写错)
// 降级到 listSkins 第一个
const availableSkins = listSkins();
if (!availableSkins.includes(activeSkinId) && availableSkins.length > 0) {
  console.log(`[main] activeSkin "${activeSkinId}" not found, fallback to "${availableSkins[0]}"`);
  activeSkinId = availableSkins[0];
  settings.write({ activeSkin: activeSkinId });
}
// 拖动时窗口位置持久化 throttle(1s/次),避免高频写盘
let lastPosWrite = 0;

// ============================================================
//  鼠标互动 —— 主进程轮询鼠标位置 + 算距离 + 推送事件给 renderer
// ============================================================
//  桌宠窗口在 setIgnoreMouse(true) 状态下收不到 mousemove
//  所以用主进程 screen.getCursorScreenPoint() 轮询(每 100ms)
//  计算:
//   - 鼠标到 hitArea 中心距离 → "凑近"反应(< 100px)
//   - 鼠标在不在 hitArea 矩形内 → hover 状态(已在 renderer 用 mouseenter/leave,但这里也兜底)
//  推送事件:
//   - pet:approach (dir: 'left'|'right', distance: px) → 桌宠朝 dir 微偏
//   - pet:near (距离 80-150px) → 50% 概率歪头/招手(由 renderer 决定)
//   - pet:hover (进入 hitArea) / pet:hover-leave
const APPROACH_DISTANCE = 100;   // 凑近触发距离
const NEAR_DISTANCE = 180;        // 歪头触发距离
let _lastApproachDir = null;
let _lastNearTiltAt = 0;  // 上次歪头时间
let _mousePollTimer = null;
let _isMouseInsideHitArea = false;

function startMousePolling() {
  if (_mousePollTimer) return;
  _mousePollTimer = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) return;
    try {
      const cursor = screen.getCursorScreenPoint();
      const bounds = petWindow.getBounds();
      // hitArea 中心:窗口中心偏下(贴底)
      const hitCenterX = bounds.x + bounds.width / 2;
      const hitCenterY = bounds.y + bounds.height - 30;  // hitArea 中心接近底部
      // hitArea 半边: 136 * petScale / 2 + 余量
      const halfW = Math.max(80, bounds.width * 0.16);
      const halfH = halfW;
      const dx = cursor.x - hitCenterX;
      const dy = cursor.y - hitCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // 1) 凑近: 距离 < APPROACH_DISTANCE → 推方向
      if (distance < APPROACH_DISTANCE) {
        // dir: 鼠标在桌宠左边还是右边(相对桌宠 x 中心)
        const dir = dx < 0 ? 'left' : 'right';
        if (dir !== _lastApproachDir) {
          _lastApproachDir = dir;
          if (petWindow && !petWindow.isDestroyed()) {
            petWindow.webContents.send('pet:approach', { dir, distance: Math.round(distance) });
          }
        }
      } else if (_lastApproachDir) {
        _lastApproachDir = null;
        if (petWindow && !petWindow.isDestroyed()) {
          petWindow.webContents.send('pet:approach', { dir: null, distance: null });
        }
      }

      // 2) 歪头: 80-180px 范围 + 冷却 3s + 50% 概率
      if (distance > 80 && distance < NEAR_DISTANCE) {
        const now = Date.now();
        if (now - _lastNearTiltAt > 3000 && Math.random() < 0.5) {
          _lastNearTiltAt = now;
          if (petWindow && !petWindow.isDestroyed()) {
            petWindow.webContents.send('pet:near-tilt');
          }
        }
      }

      // 3) hover 状态(主进程兜底,renderer mouseenter/leave 是主路径)
      const insideNow = Math.abs(dx) < halfW && Math.abs(dy) < halfH;
      if (insideNow !== _isMouseInsideHitArea) {
        _isMouseInsideHitArea = insideNow;
        if (petWindow && !petWindow.isDestroyed()) {
          petWindow.webContents.send(insideNow ? 'pet:hover' : 'pet:hover-leave');
        }
      }
    } catch (e) {
      // screen 模块在销毁时可能抛错 —— 静默
    }
  }, 100);
}

function stopMousePolling() {
  if (_mousePollTimer) {
    clearInterval(_mousePollTimer);
    _mousePollTimer = null;
  }
}

// 启动开关：透明窗口 + 软件渲染更稳
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.disableHardwareAcceleration();

// ============================================================
//  窗口管理
// ============================================================
function createPetWindow() {
  const cur = settings.read();
  const scale = cur.petScale || 1.0;
  const W = Math.round(425 * scale);
  const H = Math.round(204 * scale);

  // 启动位置:rememberPosition + 有上次坐标 → 用上次的;否则靠右下
  let startX = 100, startY = 100;
  try {
    const { width: sw, height: sh } = screen.getPrimaryDisplay().bounds;
    if (cur.rememberPosition && cur.windowPos && cur.windowPos.x != null && cur.windowPos.y != null) {
      // 校验坐标还在屏幕范围内(避免上次的双屏坐标在新环境里跑到屏幕外)
      const all = screen.getAllDisplays();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const d of all) {
        const w = d.workArea;
        minX = Math.min(minX, w.x);
        minY = Math.min(minY, w.y);
        maxX = Math.max(maxX, w.x + w.width);
        maxY = Math.max(maxY, w.y + w.height);
      }
      const x = cur.windowPos.x, y = cur.windowPos.y;
      // 至少 100x100 落在工作区内
      if (x + 100 > minX && x < maxX - 50 && y + 50 > minY && y < maxY - 50) {
        startX = x; startY = y;
      } else {
        // 越界 → 落回默认右下
        startX = Math.max(0, Math.round(sw - W - 80));
        startY = Math.max(0, Math.round(sh - H - 80));
      }
    } else {
      startX = Math.max(0, Math.round(sw - W - 80));
      startY = Math.max(0, Math.round(sh - H - 80));
    }
  } catch (e) { /* 用默认 100,100 */ }

  petWindow = new BrowserWindow({
    width: W, height: H, x: startX, y: startY,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      webSecurity: true,
    },
  });

  petWindow.setAlwaysOnTop(true, 'floating');

  // ready-to-show 后强制透明背景,避免白底闪烁
  petWindow.once('ready-to-show', () => {
    petWindow.webContents.executeJavaScript(`
      document.documentElement.style.background = 'transparent';
      document.body.style.background = 'transparent';
    `);
    petWindow.show();
  });

  // 兜底:3s 后还没 ready 也强制显示
  setTimeout(() => {
    if (petWindow && !petWindow.isVisible()) petWindow.show();
  }, 3000);

  petWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  petWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error(`[pet] did-fail-load: ${code} ${desc}`);
  });

  petWindow.on('closed', () => { petWindow = null; });

  // 拦截"关闭"按钮:默认隐藏到托盘
  petWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      hidePet();
      // 首次关闭时给个提示(tray balloon 仅 Windows)
      if (tray && !tray._balloonShown) {
        tray._balloonShown = true;
        try {
          tray.displayBalloon({
            title: '五月天桌宠',
            content: '桌宠已隐藏到托盘。右键托盘图标可以恢复。',
            iconType: 'info',
          });
        } catch (e) { /* 旧 macOS 可能不支持 */ }
      }
    }
  });
}

function showPet() {
  if (!petWindow) return;
  // Win11 透明置顶窗口 + focus stealing 政策:show() + focus() 可能
  // 导致 visible=true 但窗口被其他应用遮挡,看起来"没复原"
  // 解法:showInactive + restore() + setAlwaysOnTop 强制抢占 z-order
  if (petWindow.isMinimized()) petWindow.restore();
  petWindow.showInactive();
  petWindow.setAlwaysOnTop(true, 'floating');
  petWindow.moveTop();
  // 切回普通 'floating' level,避免 'screen-saver' 一直挡住其他窗口
  petWindow.setAlwaysOnTop(true, 'normal');
}

function hidePet() {
  if (!petWindow) return;
  petWindow.hide();
}

// ============================================================
//  共享业务逻辑 —— 多处复用
// ============================================================
const TOOLTIPS = {
  '阳光天使': '☀️ 阳光天使',
  '端午卜':   '🐉 端午卜',
  '倔强死神': '💀 倔强死神',
};

const RIGHT_MENU_TITLES = {
  '阳光天使': '🌟 阳光常伴',
  '端午卜':   '🐉 端午安康',
  '倔强死神': '💀 不死的羁绊',
};

// 皮肤显示顺序(v1.9.1 用户偏好:端午卜 → 阳光天使 → 倔强死神)
// listSkins() 默认按 unicode 字母序,这个数组控制菜单显示顺序
const SKIN_ORDER = ['端午卜', '阳光天使', '倔强死神'];

// 切换皮肤 —— IPC 路径 / 托盘菜单 / 右键菜单 三个入口都走这里
// 返回 ok 状态(IPC 路径用),托盘菜单右键入口用返回值
function switchSkinMain(skinId, source) {
  console.log(`[main] ${source} switch-skin click: ${skinId} (current=${activeSkinId})`);
  if (skinId === activeSkinId) return { ok: false, reason: 'same' };
  try {
    applySkin(skinId);
    bake();
  } catch (e) {
    // 严格校验 tray-icon 后,缺失会抛错 —— 必须 catch,
    // 否则整个 click handler 中断(settings.write / 推送 / 托盘重建 都不执行)
    // 教训:v1.4 framesScriptContent 引用 bug 同款模式
    console.error(`[main] switch-skin "${skinId}" failed:`, e.message);
    return { ok: false, error: e.message };
  }
  settings.write({ activeSkin: skinId });
  activeSkinId = skinId;

  // 推送新 frames-embed.js 到 renderer（不 reload 避免窗口闪烁）
  if (petWindow && !petWindow.isDestroyed()) {
    const framesPath = path.join(__dirname, 'renderer', 'frames-embed.js');
    const framesContent = fs.readFileSync(framesPath, 'utf8');
    console.log(`[main] send pet:skin-changed skinId=${skinId}, framesContent size=${framesContent.length}`);
    petWindow.webContents.send('pet:skin-changed', { skinId, framesContent });
  } else {
    console.log(`[main] skip send: petWindow=${!!petWindow}, destroyed=${petWindow && petWindow.isDestroyed()}`);
  }

  // 重建托盘:更新图标 + 菜单 ✓ 标记
  if (tray && !tray.isDestroyed()) {
    try {
      const newIconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
      tray.setImage(nativeImage.createFromPath(newIconPath));
    } catch (e) { console.error('[tray] setImage failed:', e); }
    buildTrayMenu();
  }

  return { ok: true, skinId };
}

// 退出 —— bye 动画后 app.quit(),IPC/托盘/右键三个入口都走这里
function quitWithBye() {
  isQuitting = true;
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('pet:menu-action', 'bye');
    setTimeout(() => app.quit(), 1200);
  } else {
    app.quit();
  }
}

// 托盘图标点击:显隐切换
function togglePet() {
  if (!petWindow) return;
  if (petWindow.isVisible()) hidePet();
  else showPet();
}

// ============================================================
//  自定义皮肤 —— 拖 PNG 到窗口保存为新 skin
// ============================================================

// 接收 renderer 拖入的 PNG base64,保存为 skins/<skinId>/frames/ 下的 PNG
ipcMain.handle('pet:install-skin', async (_evt, { name, pngBase64 }) => {
  if (!name || !pngBase64) return { ok: false, error: '缺少 name 或 pngBase64' };
  // 安全的 skinId: 中文/英文/数字/_ -
  const skinId = name.trim().slice(0, 30) || `皮肤${Date.now()}`;
  const skinDir = path.join(SKINS, skinId, 'frames');
  await fs.promises.mkdir(skinDir, { recursive: true });
  // base64 去掉 data:image/png;base64, 前缀
  const data = pngBase64.replace(/^data:image\/\w+;base64,/, '');
  const buf = Buffer.from(data, 'base64');
  if (buf.length < 100) return { ok: false, error: 'PNG 太小,可能损坏' };
  // 复制给 5 帧 + tray-icon
  for (const f of ['pet.png', 'pet-eye-closed.png', 'pet-sleep.png', 'pet-sing.png', 'pet-wave.png']) {
    await fs.promises.writeFile(path.join(skinDir, f), buf);
  }
  // 用我们通用 make-tray.py 脚本生成 tray-icon(从 pet.png 取主体,缩 32x32)
  const { spawnSync } = require('child_process');
  const py = spawnSync('python', [
    path.join(__dirname, '..', 'scripts', 'make-tray.py'),
    '--skin', skinId,
    '--source', 'pet.png',
  ], { encoding: 'utf-8' });
  if (py.status !== 0) {
    console.error('[install-skin] make-tray.py failed:', py.stderr);
    return { ok: false, error: 'tray-icon 生成失败:' + (py.stderr || '').slice(0, 200) };
  }
  // bake + 切到新皮肤
  try {
    applySkin(skinId);
    bake();
  } catch (e) {
    return { ok: false, error: e.message };
  }
  settings.write({ activeSkin: skinId });
  activeSkinId = skinId;
  // 推送新 frames
  if (petWindow && !petWindow.isDestroyed()) {
    const framesPath = path.join(__dirname, 'renderer', 'frames-embed.js');
    const framesContent = fs.readFileSync(framesPath, 'utf8');
    petWindow.webContents.send('pet:skin-changed', { skinId, framesContent });
  }
  // 重建托盘
  if (tray && !tray.isDestroyed()) {
    try { tray.setImage(nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'tray-icon.png'))); } catch (e) {}
    buildTrayMenu();
  }
  return { ok: true, skinId };
});

// ============================================================
//  托盘
// ============================================================
function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  tray = new Tray(nativeImage.createFromPath(iconPath));
  // tooltip 走 applyProfileToUI 在 app.whenReady 后再刷一次
  tray.setToolTip(TOOLTIPS[activeSkinId] || '桌宠');
  buildTrayMenu();
}

function buildTrayMenu() {
  if (!tray || tray.isDestroyed()) return;
  const contextMenu = Menu.buildFromTemplate([
    { label: '🎭 当前皮肤: ' + activeSkinId, enabled: false },
    { type: 'separator' },
    {
      label: '切换皮肤',
      submenu: listSkins().map(skinId => ({
        label: skinId + (skinId === activeSkinId ? ' ✓' : ''),
        click: () => switchSkinMain(skinId, 'tray'),
      })),
    },
    { type: 'separator' },
    { label: '显示桌宠', click: showPet },
    { label: '隐藏桌宠', click: hidePet },
    { type: 'separator' },
    { label: '⚙️ 设置',  click: openSettingsWindow },
    { type: 'separator' },
    { label: '🚪 退出',   click: quitWithBye },
  ]);
  tray.setContextMenu(contextMenu);

  // 单击/双击托盘:Win11 双击不可靠(系统层吞了),单击稳定触发。
  // → 单击直接 toggle,右键菜单保留为备用入口。
  tray.on('click', () => togglePet());
  tray.on('double-click', () => togglePet());
}

// ============================================================
//  IPC —— preload 暴露的 petAPI
// ============================================================
ipcMain.handle('pet:move', (_evt, dx, dy) => {
  if (!petWindow) return;
  const b = petWindow.getBounds();
  // 限定在所有显示器的工作区内
  const all = screen.getAllDisplays();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of all) {
    const w = d.workArea;
    minX = Math.min(minX, w.x);
    minY = Math.min(minY, w.y);
    maxX = Math.max(maxX, w.x + w.width);
    maxY = Math.max(maxY, w.y + w.height);
  }
  const nx = Math.max(minX, Math.min(b.x + dx, maxX - b.width));
  const ny = Math.max(minY, Math.min(b.y + dy, maxY - b.height));
  petWindow.setBounds({ x: nx, y: ny, width: b.width, height: b.height });
  // 持久化窗口位置(rememberPosition=on 时)—— throttle 1s/次
  const cur = settings.read();
  if (cur.rememberPosition) {
    const now = Date.now();
    if (now - lastPosWrite >= 1000) {
      lastPosWrite = now;
      settings.write({ windowPos: { x: Math.round(nx), y: Math.round(ny) } });
    }
  }
});

// 点击命中 hitArea → 桌宠"躲避" 鼠标方向
// renderer 检测到 click(不是 drag)后调用
// 方向: 远离鼠标
ipcMain.handle('pet:dodge', () => {
  if (!petWindow) return;
  const b = petWindow.getBounds();
  const cursor = screen.getCursorScreenPoint();
  // hitArea 中心
  const hitCenterX = b.x + b.width / 2;
  // 远离方向(左/右)
  const dx = cursor.x - hitCenterX;
  let moveX = dx < 0 ? -80 : 80;
  // 50% 概率也垂直闪躲
  let moveY = 0;
  if (Math.random() < 0.5) moveY = (Math.random() < 0.5 ? -30 : 30);
  // 限定范围
  const all = screen.getAllDisplays();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of all) {
    const w = d.workArea;
    minX = Math.min(minX, w.x);
    minY = Math.min(minY, w.y);
    maxX = Math.max(maxX, w.x + w.width);
    maxY = Math.max(maxY, w.y + w.height);
  }
  const nx = Math.max(minX, Math.min(b.x + moveX, maxX - b.width));
  const ny = Math.max(minY, Math.min(b.y + moveY, maxY - b.height));
  petWindow.setBounds({ x: nx, y: ny, width: b.width, height: b.height });
  // 持久化
  const cur = settings.read();
  if (cur.rememberPosition) {
    settings.write({ windowPos: { x: Math.round(nx), y: Math.round(ny) } });
  }
  return { ok: true, dx: moveX, dy: moveY };
});

ipcMain.handle('pet:set-ignore-mouse', (_evt, ignore) => {
  if (!petWindow) return;
  // { forward: true } 穿透时事件下传到下面窗口
  petWindow.setIgnoreMouseEvents(!!ignore, { forward: true });
});

// 桌宠缩放 —— 实时改变窗口大小 + 调整位置保持贴右下
// 默认 425x204,scale 0.8-1.2
ipcMain.handle('pet:resize-window', (_evt, scale) => {
  if (!petWindow) return;
  const s = Math.max(0.5, Math.min(1.5, Number(scale) || 1.0));
  const W = Math.round(425 * s);
  const H = Math.round(204 * s);
  // 保持右下角位置(对应屏幕右下)
  const b = petWindow.getBounds();
  let nx = b.x, ny = b.y;
  try {
    const { width: sw, height: sh } = screen.getPrimaryDisplay().bounds;
    nx = Math.max(0, Math.round(sw - W - 80));
    ny = Math.max(0, Math.round(sh - H - 80));
  } catch (e) {}
  petWindow.setBounds({ x: nx, y: ny, width: W, height: H });
});

ipcMain.handle('pet:quit', () => quitWithBye());

ipcMain.handle('pet:show-menu', (event, pos) => {
  if (!petWindow) return;
  const menuTitle = RIGHT_MENU_TITLES[activeSkinId] || `✨ ${activeSkinId}`;
  const menu = Menu.buildFromTemplate([
    { label: menuTitle, enabled: false },
    { type: 'separator' },
    { label: '👋 打个招呼',     click: () => petWindow.webContents.send('pet:menu-action', 'greet') },
    { label: '🎤 让它唱首歌',   click: () => petWindow.webContents.send('pet:menu-action', 'sing') },
    { label: '😊 让它笑一下',   click: () => petWindow.webContents.send('pet:menu-action', 'smile') },
    { label: '💖 比心',         click: () => petWindow.webContents.send('pet:menu-action', 'heart') },
    { label: '🔊 朗读这条',     click: () => petWindow.webContents.send('pet:menu-action', 'speak') },
    { label: '😴 让它睡觉',     click: () => petWindow.webContents.send('pet:menu-action', 'sleep') },
    { type: 'separator' },
    { label: '🍅 番茄钟',       click: async () => {
        const s = await notifications.getPomodoroStatus();
        if (s && s.active) {
          notifications.stopPomodoro();
        } else {
          notifications.startPomodoro();
        }
      } },
    { label: '💧 我刚喝过水',   click: () => {
        notifications.ackHydration();
        petWindow.webContents.send('pet:menu-action', 'hydrated');
      } },
    { label: '🪑 我起来活动',   click: () => {
        notifications.ackSedentary();
        petWindow.webContents.send('pet:menu-action', 'stretched');
      } },
    { type: 'separator' },
    { label: '✏️ 加一句金句',   click: () => petWindow.webContents.send('pet:menu-action', 'add-line') },
    { label: '📅 加纪念日',     click: () => petWindow.webContents.send('pet:menu-action', 'add-anniversary') },
    { type: 'separator' },
    {
      label: '🎭 切换皮肤',
      submenu: listSkins().map(skinId => ({
        label: skinId + (skinId === activeSkinId ? ' ✓' : ''),
        click: () => switchSkinMain(skinId, 'menu'),
      })),
    },
    { type: 'separator' },
    { label: '⚙️ 设置',         click: openSettingsWindow },
    { label: '👋 隐藏到托盘',   click: hidePet },
    { label: '🚪 退出桌宠',     click: quitWithBye },
  ]);
  const win = BrowserWindow.fromWebContents(event.sender);
  menu.popup({ window: win, x: pos.x, y: pos.y });
});

ipcMain.handle('pet:switch-skin', (_evt, skinId) => {
  if (!skinId) return { ok: false, error: 'no skin id' };
  if (!listSkins().includes(skinId)) return { ok: false, error: `unknown skin: ${skinId}` };
  return switchSkinMain(skinId, 'ipc');
});

ipcMain.handle('pet:get-skin', () => ({
  activeSkin: activeSkinId,
  available: listSkins(),
}));

// 互动统计：读取 / 累加某项 —— 委托给 settings.stat
ipcMain.handle('pet:stat', (_evt, op) => settings.stat(op));

// 自定义金句: get / add / remove
ipcMain.handle('pet:custom-lines', (_evt, op, line) => {
  const cur = settings.read();
  if (op === 'get') return cur.customLines || [];
  if (op === 'add' && typeof line === 'string' && line.trim()) {
    const lines = cur.customLines || [];
    if (!lines.includes(line.trim())) {
      lines.push(line.trim());
      settings.write({ customLines: lines });
    }
    return lines;
  }
  if (op === 'remove' && typeof line === 'string') {
    const lines = (cur.customLines || []).filter(l => l !== line);
    settings.write({ customLines: lines });
    return lines;
  }
  return cur.customLines || [];
});

// 纪念日: get / add / remove
ipcMain.handle('pet:anniversaries', (_evt, op, data) => {
  const cur = settings.read();
  if (op === 'get') return cur.anniversaries || [];
  if (op === 'add' && data && data.month && data.day && data.label) {
    const items = cur.anniversaries || [];
    const advance = data.advance !== false;  // 默认提前 1 天提醒
    items.push({ month: data.month, day: data.day, label, advance });
    settings.write({ anniversaries: items });
    return items;
  }
  if (op === 'remove' && typeof data === 'number') {
    const items = (cur.anniversaries || []).filter((_, i) => i !== data);
    settings.write({ anniversaries: items });
    return items;
  }
  return cur.anniversaries || [];
});

// 气泡反馈: 喜欢/不喜欢 —— 记录到 settings
// simple 评分: disliked -2, liked +1, 累加到 bubbleRatings[text]
ipcMain.handle('pet:bubble-feedback', (_evt, text, isLike) => {
  if (!text) return;
  const cur = settings.read();
  const ratings = cur.bubbleRatings || {};
  const cur2 = ratings[text] || 0;
  ratings[text] = cur2 + (isLike ? 1 : -2);
  settings.write({ bubbleRatings: ratings });
  return ratings[text];
});

// ============================================================
//  天气模块 —— wttr.in 免费无 key,中文城市名
// ============================================================
//  缓存: 同一天同一城市复用,跨日失效
const weatherCache = { date: '', location: '', data: null };

// weatherCode → 中文 + emoji
// 来自 wttr.in 官方 weatherCode 列表
const WEATHER_MAP = {
  113: { zh: '晴', emoji: '☀️' },
  116: { zh: '多云', emoji: '⛅' },
  119: { zh: '阴', emoji: '☁️' },
  122: { zh: '阴', emoji: '☁️' },
  143: { zh: '有雾', emoji: '🌫️' },
  176: { zh: '零星阵雨', emoji: '🌦️' },
  179: { zh: '零星雨雪', emoji: '🌨️' },
  182: { zh: '零星雨雪', emoji: '🌨️' },
  185: { zh: '零星冻雨', emoji: '🌧️' },
  200: { zh: '雷雨', emoji: '⛈️' },
  227: { zh: '飘雪', emoji: '🌨️' },
  230: { zh: '暴雪', emoji: '❄️' },
  248: { zh: '雾', emoji: '🌫️' },
  260: { zh: '浓雾', emoji: '🌫️' },
  263: { zh: '毛毛雨', emoji: '🌦️' },
  266: { zh: '小雨', emoji: '🌦️' },
  281: { zh: '冻雨', emoji: '🌧️' },
  284: { zh: '冻雨', emoji: '🌧️' },
  293: { zh: '零星小雨', emoji: '🌦️' },
  296: { zh: '小雨', emoji: '🌦️' },
  299: { zh: '阵雨', emoji: '🌧️' },
  302: { zh: '中雨', emoji: '🌧️' },
  305: { zh: '大雨', emoji: '🌧️' },
  308: { zh: '暴雨', emoji: '⛈️' },
  311: { zh: '冻雨', emoji: '🌧️' },
  314: { zh: '冻雨', emoji: '🌧️' },
  317: { zh: '冻雨', emoji: '🌧️' },
  320: { zh: '小雪', emoji: '🌨️' },
  323: { zh: '小雪', emoji: '🌨️' },
  326: { zh: '阵雪', emoji: '🌨️' },
  329: { zh: '中雪', emoji: '❄️' },
  332: { zh: '中雪', emoji: '❄️' },
  335: { zh: '大雪', emoji: '❄️' },
  338: { zh: '暴雪', emoji: '❄️' },
  350: { zh: '冰雹', emoji: '🌨️' },
  353: { zh: '零星阵雨', emoji: '🌦️' },
  356: { zh: '中阵雨', emoji: '🌧️' },
  359: { zh: '暴阵雨', emoji: '⛈️' },
  362: { zh: '零星阵雨夹雪', emoji: '🌨️' },
  365: { zh: '中阵雨夹雪', emoji: '🌨️' },
  368: { zh: '阵雪', emoji: '🌨️' },
  371: { zh: '中阵雪', emoji: '❄️' },
  374: { zh: '冰雹', emoji: '🌨️' },
  377: { zh: '中度冰雹', emoji: '🌨️' },
  386: { zh: '雷阵雨', emoji: '⛈️' },
  389: { zh: '强雷阵雨', emoji: '⛈️' },
  392: { zh: '零星雷阵雪', emoji: '⛈️' },
  395: { zh: '中度雷阵雪', emoji: '⛈️' },
  398: { zh: '烟尘', emoji: '🌫️' },
  399: { zh: '烟霾', emoji: '🌫️' },
};

function getWeatherDesc(code) {
  return WEATHER_MAP[code] || { zh: '未知', emoji: '🌡️' };
}

// 拉 wttr.in JSON
function fetchWttrIn(location, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (!location) {
      reject(new Error('no location'));
      return;
    }
    // wttr.in 不接受中文以外的 location 编码,直接用 URL 编码
    const url = `https://wttr.in/${encodeURIComponent(location)}?format=j1&lang=zh`;
    const req = https.get(url, {
      headers: {
        'User-Agent': 'curl/7.88',  // 强制返回 JSON,避开 HTML
        'Accept-Language': 'zh-CN',
      },
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('JSON parse failed'));
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', (e) => reject(e));
  });
}

// 取今日天气(带缓存)
async function getWeather(location) {
  const today = new Date().toISOString().slice(0, 10);
  if (weatherCache.date === today && weatherCache.location === location && weatherCache.data) {
    return { ok: true, cached: true, ...weatherCache.data };
  }
  try {
    const json = await fetchWttrIn(location);
    const cur = json.current_condition && json.current_condition[0];
    const area = json.nearest_area && json.nearest_area[0];
    if (!cur) throw new Error('no current_condition');

    const desc = getWeatherDesc(parseInt(cur.weatherCode, 10));
    const temp = parseInt(cur.temp_C, 10);
    const feels = parseInt(cur.FeelsLikeC, 10);
    const humidity = parseInt(cur.humidity, 10);
    const wind = parseInt(cur.windspeedKmph, 10);

    // 中文城市名(wttr 经常返回 nearest_area 是区名, 比如上海→Pootung,我们用用户输入)
    // 优先级: 用户输入 > region > areaName
    let displayLocation = location;
    if (location && location.trim()) {
      displayLocation = location.trim();
    } else if (area) {
      // 没用户输入 → 用 region(省市), 凑合用
      const region = area.region && area.region[0] && area.region[0].value;
      const country = area.country && area.country[0] && area.country[0].value;
      displayLocation = region || (area.areaName && area.areaName[0] && area.areaName[0].value) || country || '未知';
    }

    const payload = {
      desc: desc.zh,
      emoji: desc.emoji,
      temp,
      feels,
      humidity,
      wind,
      location: displayLocation,
    };
    weatherCache.date = today;
    weatherCache.location = location;
    weatherCache.data = payload;
    return { ok: true, cached: false, ...payload };
  } catch (e) {
    return { ok: false, reason: e.message || 'unknown' };
  }
}

ipcMain.handle('pet:get-weather', async (_evt, location) => {
  return await getWeather(location || '');
});

// ============================================================
//  IP 定位 —— ip-api.com 免费,无 key,支持 lang=zh-CN 返回中文城市名
// ============================================================
//  缓存: 进程内同 IP 同天复用 (用户 IP 不会变)
//  失败兜底: 返回 { ok: false, reason }
const ipLocationCache = { date: '', ip: '', data: null };

function fetchIpLocation(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const url = 'http://ip-api.com/json/?lang=zh-CN';
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        try {
          const json = JSON.parse(data);
          if (json.status !== 'success') {
            reject(new Error(json.message || 'ip-api status fail'));
            return;
          }
          resolve({
            ip: json.query,
            country: json.country,
            countryCode: json.countryCode,
            region: json.regionName,
            city: json.city,
            zip: json.zip,
            lat: json.lat,
            lon: json.lon,
            timezone: json.timezone,
            isp: json.isp,
          });
        } catch (e) {
          reject(new Error('JSON parse failed'));
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', (e) => reject(e));
  });
}

async function getIpLocation() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    // 先 ping 拿 IP(用上一次缓存的 IP 当 key)
    // 简化: 每次都拉,5s 一次(用户在设置里点"重新定位")
    const data = await fetchIpLocation();
    ipLocationCache.date = today;
    ipLocationCache.data = data;
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, reason: e.message || 'unknown' };
  }
}

ipcMain.handle('pet:get-ip-location', async () => {
  return await getIpLocation();
});

// ============================================================
//  v1.11.5: TTS 语音合成 + 播放 —— 走 edge-tts 拿 mp3 + 主进程直接播放
//  设计原因: Electron 透明窗口下 <audio> 元素 audio.play() 经常静默失败,
//           主进程用 sound-play 走系统音频设备,绕开 sandbox 问题
// ============================================================
const { synthesize, pickVoiceByProfile } = require('../scripts/edge-tts.js');
const soundPlay = require('sound-play');
const os = require('os');
const crypto = require('crypto');

// 临时目录存放 mp3,播完删
const TTS_TMP_DIR = path.join(os.tmpdir(), 'desktop-pet-tts');
if (!fs.existsSync(TTS_TMP_DIR)) {
  fs.mkdirSync(TTS_TMP_DIR, { recursive: true });
}

ipcMain.handle('pet:tts-speak', async (_evt, text, opts) => {
  try {
    // v1.11.5: 检查 tts.enabled 总开关(防止 renderer 端检查失效时还朗读)
    const s = settings.read();
    if (!s.tts || s.tts.enabled === false) {
      return { ok: false, error: 'tts disabled' };
    }
    let voice;
    if (opts && opts.voice) {
      voice = opts.voice;
    } else {
      const profile = settings.read().petProfile || {};
      voice = pickVoiceByProfile(profile.gender, profile.birthday);
    }
    const userRate = (opts && opts.rate) || '+0%';
    console.log('[tts-speak] voice=', voice, 'text=', text.slice(0, 30), 'rate=', userRate);
    const buf = await synthesize(text, {
      voice,
      rate: userRate,
      pitch: (opts && opts.pitch) || '+0Hz',
      volume: (opts && opts.volume) || '+0%',
    });
    // 写到临时文件 + 用 sound-play 播放 + 延后清理
    const filename = `tts-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.mp3`;
    const filepath = path.join(TTS_TMP_DIR, filename);
    fs.writeFileSync(filepath, buf);
    console.log('[tts-speak] mp3 saved:', filepath, '(', buf.length, 'bytes )');
    // 异步播放(不阻塞 IPC)
    soundPlay.play(filepath).then(() => {
      console.log('[tts-speak] played OK');
    }).catch((e) => {
      console.error('[tts-speak] sound-play failed:', e.message);
    }).finally(() => {
      // 5 秒后清理临时文件(给 audio 设备留缓冲)
      setTimeout(() => {
        try { fs.unlinkSync(filepath); } catch (e) { /* ignore */ }
      }, 5000);
    });
    // v1.11.5: 估算 mp3 时长,renderer 用来延长气泡显示时间,避免文字消失后声音还在继续
    // 估算依据:中文 YunyangNeural 语速约 4-5 字/秒(实际测得),按用户 rate 调整
    // rate='+70%' → factor=1.7 → 实际播放时长 = 基础时长 / 1.7
    const ratePct = parseInt(userRate.replace(/[^-\d]/g, '')) || 0;
    const factor = 1 + ratePct / 100;
    const charCount = text.replace(/[｜\s]/g, '').length;  // 排除 ｜ 和空格
    const baseSec = charCount * 0.25;  // 4 字/秒
    const estimatedDurationMs = Math.max(800, (baseSec / factor) * 1000);
    return { ok: true, voice, bytes: buf.length, estimatedDurationMs };
  } catch (e) {
    console.error('[tts-speak] failed:', e.message);
    return { ok: false, error: e.message };
  }
});

// 返回推荐 voice 列表(settings.js 用)
ipcMain.handle('pet:tts-list-voices', () => {
  const { RECOMMENDED_VOICES } = require('../scripts/edge-tts.js');
  return RECOMMENDED_VOICES;
});

// ============================================================
//  v1.13 定时通知(番茄钟/喝水/久坐)—— 调度器 IPC
// ============================================================
const notifications = require('../scripts/notifications.js');

ipcMain.handle('pet:notif-start-pomodoro', () => notifications.startPomodoro());
ipcMain.handle('pet:notif-stop-pomodoro', () => notifications.stopPomodoro());
ipcMain.handle('pet:notif-pomodoro-status', () => notifications.getPomodoroStatus());
ipcMain.handle('pet:notif-ack-hydration', () => notifications.ackHydration());
ipcMain.handle('pet:notif-ack-sedentary', () => notifications.ackSedentary());

// ============================================================
//  设置窗口 —— v1.7 新增
// ============================================================
let settingsWindow = null;
function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }
  // 中心位置
  let cx = 400, cy = 200;
  try {
    const { width: sw, height: sh } = screen.getPrimaryDisplay().bounds;
    cx = Math.max(0, Math.round((sw - 480) / 2));
    cy = Math.max(0, Math.round((sh - 600) / 2));
  } catch (e) {}
  settingsWindow = new BrowserWindow({
    width: 480, height: 600, x: cx, y: cy,
    show: false,
    frame: true,                 // 有边框（标准窗口：用户能最小化/关闭/拖动）
    transparent: false,
    alwaysOnTop: false,
    resizable: true,
    minimizable: true,
    maximizable: false,
    title: '桌宠 · 设置',
    backgroundColor: '#1e1e2e',  // 暗色背景，避免白底闪烁
    webPreferences: {
      preload: path.join(__dirname, 'preload-settings.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      webSecurity: true,
    },
  });
  settingsWindow.setMenuBarVisibility(false);
  // 用 petProfile.name 当设置窗口标题
  const profile = settings.read().petProfile || {};
  const petName = (profile.name || '').trim();
  settingsWindow.setTitle(petName ? `${petName} · 设置` : '桌宠 · 设置');
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWindow.once('ready-to-show', () => settingsWindow.show());
  settingsWindow.on('closed', () => {
    settingsWindow = null;
    notifications.setSettingsWindow(null);
  });
  // v1.13.1: 把 settingsWindow 推给 notifications,实时推 pet:notification 给设置面板
  notifications.setSettingsWindow(settingsWindow);
}

// 读 / 写 user preferences (bubbleFrequency / typingSpeed / theme / autoLaunch / rememberPosition / petScale)
ipcMain.handle('pet:get-prefs', () => {
  const s = settings.read();
  return {
    bubbleFrequency: s.bubbleFrequency,
    typingSpeed: s.typingSpeed,
    theme: s.theme,
    autoLaunch: s.autoLaunch,
    rememberPosition: s.rememberPosition,
    petScale: s.petScale,
    activeSkin: s.activeSkin,
    // v1.9 天气字段
    weather: s.weather || { city: '', enabled: true },
    // v1.11 TTS 字段
    tts: s.tts || { enabled: true, rate: 1.0, pitch: 1.0, volume: 1.0, voicePref: 'auto', customVoice: '' },
    // v1.13 定时通知
    notifications: s.notifications || { pomodoro: true, hydration: true, sedentary: true, workMin: 25, restMin: 5, hydrationMin: 60, sedentaryMin: 60 },
  };
});

ipcMain.handle('pet:set-prefs', (_evt, prefs) => {
  if (!prefs || typeof prefs !== 'object') return { ok: false, error: 'no prefs' };
  const safe = validatePrefs(prefs);
  // weather.city 为空时跳过 weather 字段(保留 settings.json 旧值)
  if (safe.weather && (!safe.weather.city || safe.weather.city.trim() === '')) {
    console.log('[prefs] skip empty weather.city, preserve old value');
    delete safe.weather;
  }
  settings.write(safe);
  // autoLaunch 立刻生效
  if ('autoLaunch' in safe) {
    try {
      app.setLoginItemSettings({ openAtLogin: !!safe.autoLaunch });
    } catch (e) {
      console.error('[prefs] setLoginItemSettings failed:', e.message);
    }
  }
  // 通知 petWindow 设置已变（窗口位置、缩放、词库、速度等都靠这个实时刷新）
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('pet:prefs-changed', safe);
  }
  return { ok: true, saved: safe };
});

// 共享的 prefs 校验函数(set-prefs 内部用)
function validatePrefs(prefs) {
  const valid = {
    bubbleFrequency: ['low', 'normal', 'high'],
    typingSpeed: (n) => typeof n === 'number' && n >= 30 && n <= 150,
    theme: ['mayday', 'default', 'classical'],
    autoLaunch: (v) => typeof v === 'boolean',
    rememberPosition: (v) => typeof v === 'boolean',
    petScale: (n) => typeof n === 'number' && n >= 0.8 && n <= 1.2,
    // v1.9 天气字段:嵌套对象 { city, enabled }
    weather: (v) => v && typeof v === 'object'
      && typeof v.city === 'string' && v.city.length <= 50
      && typeof v.enabled === 'boolean',
    // v1.11 TTS 字段:嵌套对象 { enabled, rate, pitch, volume }
    tts: (v) => v && typeof v === 'object'
      && typeof v.enabled === 'boolean'
      && (v.rate == null || (typeof v.rate === 'number' && v.rate >= 0.5 && v.rate <= 2.0))
      && (v.pitch == null || (typeof v.pitch === 'number' && v.pitch >= 0 && v.pitch <= 2.0))
      && (v.volume == null || (typeof v.volume === 'number' && v.volume >= 0 && v.volume <= 1.0))
      && (v.voicePref == null || ['auto', 'female', 'male', 'custom'].includes(v.voicePref))
      && (v.customVoice == null || (typeof v.customVoice === 'string' && v.customVoice.length <= 40)),
    // v1.13 定时通知
    notifications: (v) => v && typeof v === 'object'
      && (v.pomodoro == null || typeof v.pomodoro === 'boolean')
      && (v.hydration == null || typeof v.hydration === 'boolean')
      && (v.sedentary == null || typeof v.sedentary === 'boolean')
      && (v.workMin == null || (typeof v.workMin === 'number' && v.workMin >= 15 && v.workMin <= 60))
      && (v.restMin == null || (typeof v.restMin === 'number' && v.restMin >= 3 && v.restMin <= 15))
      && (v.hydrationMin == null || (typeof v.hydrationMin === 'number' && v.hydrationMin >= 30 && v.hydrationMin <= 180))
      && (v.sedentaryMin == null || (typeof v.sedentaryMin === 'number' && v.sedentaryMin >= 30 && v.sedentaryMin <= 180)),
  };
  const safe = {};
  for (const [k, v] of Object.entries(prefs)) {
    if (!(k in valid)) continue;
    if (Array.isArray(valid[k]) && !valid[k].includes(v)) continue;
    if (typeof valid[k] === 'function' && !valid[k](v)) continue;
    safe[k] = v;
  }
  return safe;
}

// ============================================================
//  宠物档案 —— v1.8 新增
// ============================================================
const ZODIAC_LIST = [
  '白羊座', '金牛座', '双子座', '巨蟹座',
  '狮子座', '处女座', '天秤座', '天蝎座',
  '射手座', '摩羯座', '水瓶座', '双鱼座',
];
const MBTI_LIST = [
  'ISTJ', 'ISFJ', 'INFJ', 'INTJ',
  'ISTP', 'ISFP', 'INFP', 'INTP',
  'ESTP', 'ESFP', 'ENFP', 'ENTP',
  'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ',
];
// 从公历月日推导星座
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

ipcMain.handle('pet:get-profile', () => {
  const s = settings.read();
  return s.petProfile || {};
});

ipcMain.handle('pet:set-profile', (_evt, profile) => {
  if (!profile || typeof profile !== 'object') return { ok: false, error: 'no profile' };
  const cur = settings.read().petProfile || {};
  const safe = {};
  // name: 字符串,1-10字
  if ('name' in profile) {
    const n = String(profile.name || '').trim().slice(0, 10);
    safe.name = n;
  }
  // birthday: { month:1-12, day:1-31 }
  if ('birthday' in profile && profile.birthday && typeof profile.birthday === 'object') {
    const m = parseInt(profile.birthday.month, 10);
    const d = parseInt(profile.birthday.day, 10);
    if (Number.isFinite(m) && m >= 0 && m <= 12 && Number.isFinite(d) && d >= 0 && d <= 31) {
      safe.birthday = { month: m, day: d };
    }
  }
  // zodiac: 12 星座(只接受预定义值)
  if ('zodiac' in profile) {
    if (profile.zodiac === '' || ZODIAC_LIST.includes(profile.zodiac)) {
      safe.zodiac = profile.zodiac;
    }
  }
  // gender
  if ('gender' in profile) {
    if (['female', 'male', 'other'].includes(profile.gender)) {
      safe.gender = profile.gender;
    }
  }
  // mbti
  if ('mbti' in profile) {
    if (profile.mbti === '' || MBTI_LIST.includes(profile.mbti)) {
      safe.mbti = profile.mbti;
    }
  }
  // birthdayAt:首次设置生日时记录;生日被清空时也清掉(避免周年纪念算错)
  const hadBirthday = cur.birthday && cur.birthday.month > 0 && cur.birthday.day > 0;
  if (safe.birthday) {
    if (safe.birthday.month > 0 && safe.birthday.day > 0) {
      // 有完整生日
      if (!hadBirthday) safe.birthdayAt = Date.now();  // 首次设置
      // 如果之前有,保留原 birthdayAt
    } else {
      // 生日被清空 → 也清掉 birthdayAt
      safe.birthdayAt = null;
    }
  }
  settings.write({ petProfile: safe });
  // 通知 petWindow / 设置窗口
  const fullProfile = settings.read().petProfile;
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('pet:profile-changed', fullProfile);
  }
  // 主进程立刻更新 title / tooltip
  applyProfileToUI(fullProfile);
  return { ok: true, applied: safe, profile: fullProfile };
});

// 把 petProfile 应用到主进程 UI(title / tooltip)
function applyProfileToUI(profile) {
  const name = (profile && profile.name || '').trim();
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.setTitle(name ? `${name} · 设置` : '桌宠 · 设置');
  }
  if (tray && !tray.isDestroyed()) {
    const base = TOOLTIPS[activeSkinId] || '桌宠';
    tray.setToolTip(name ? `${base} · ${name}` : base);
  }
}

// 拖动时持久化窗口位置 —— 备用 IPC(主流程在 pet:move 内部已写,这里是给其他场景)
// 注:throttle 用的 lastPosWrite 已在文件顶部声明
ipcMain.handle('pet:save-window-pos', (_evt, pos) => {
  if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;
  const cur = settings.read();
  if (!cur.rememberPosition) return;  // 用户关掉了
  const now = Date.now();
  if (now - lastPosWrite < 1000) return;
  lastPosWrite = now;
  settings.write({ windowPos: { x: Math.round(pos.x), y: Math.round(pos.y) } });
});

// 重置所有数据 —— unlink settings.json 让下次 read() 走默认
ipcMain.handle('pet:reset-all', () => {
  try {
    if (fs.existsSync(settings.SETTINGS_PATH)) {
      fs.unlinkSync(settings.SETTINGS_PATH);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// settings 窗口自触发 blur/focus 循环 —— 修复 Win32 transparent 父窗口下
// "重置后 input 不接收字符" 问题(用户切窗口后能正常输入的现象)
ipcMain.handle('pet:reset-window-focus', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    try {
      // 临时切到非 focus,再 focus 回来 —— 强制 Chromium 重新评估 IME 状态
      settingsWindow.blur();
      setTimeout(() => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
          settingsWindow.focus();
        }
      }, 50);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  return { ok: false, error: 'no settings window' };
});

// ============================================================
//  生命周期
// ============================================================
app.whenReady().then(() => {
  // 启动时确保 assets/ 反映当前激活皮肤
  applySkin(activeSkinId);
  bake();
  createPetWindow();
  createTray();
  // 启动后用 petProfile.name 刷新托盘 tooltip(默认'桌宠')
  applyProfileToUI(settings.read().petProfile || {});
  // 启动鼠标互动轮询(主进程算距离 + 推送事件给 renderer)
  startMousePolling();
  // 启动定时通知调度器(v1.13 —— 番茄钟/喝水/久坐)
  notifications.start({ petWindow, settings });
});

// macOS 默认会保持应用运行(即使窗口关闭),Windows 默认退出
// 用托盘保持运行 —— 两种平台都一样
app.on('window-all-closed', (e) => {
  if (!isQuitting) {
    e.preventDefault?.();
    return;
  }
  app.quit();
});

// 退出前清理托盘
app.on('before-quit', () => {
  isQuitting = true;
  stopMousePolling();  // 停止鼠标轮询
  if (tray) {
    tray.destroy();
    tray = null;
  }
});