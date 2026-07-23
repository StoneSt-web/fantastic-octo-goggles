// 把指定皮肤的 PNG 转 base64，写到 src/renderer/frames-embed.js
// 用法：
//   node bake-png.js              -> 用 assets/ 目录（当前激活皮肤）
//   node bake-png.js --skin <id>  -> 从 skins/<id>/frames/ 复制到 assets/ 再 bake
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const SKINS = path.join(ROOT, 'skins');
const OUT = path.join(ROOT, 'src', 'renderer', 'frames-embed.js');
// 帧名约定：
//   pet.png = idle（默认睁眼）
//   pet-eye-closed.png = blink（眨眼，眯眼笑）
//   pet-sleep.png = sleep（睡觉持续闭眼）
//   pet-sing.png = sing（唱歌张嘴）
//   pet-wave.png = wave（打招呼举手）—— 替代原 surprised（surprised v1.4 决策搁置未使用）
const FRAMES = [
  { name: 'idle', file: 'pet.png' },
  { name: 'blink', file: 'pet-eye-closed.png' },
  { name: 'sleep', file: 'pet-sleep.png' },
  { name: 'sing', file: 'pet-sing.png' },
  { name: 'wave', file: 'pet-wave.png' },
  { name: 'tray-icon', file: 'tray-icon.png', required: true },  // 系统托盘图标 —— 缺失必须报错（任务栏会无显示）
];

// 历史遗留文件 —— assets/ 里可能有上版本复制过来但现在不用的文件(bake 后会残留)
// 比如: pet-original.png (源图副本), pet-surprised.png (v1.4 决策搁置)
// 切换皮肤前主动清掉,避免越积越多。
const STALE_FILES = [
  'pet-original.png',
  'pet-surprised.png',
];

// tray-icon 校验：32x32 RGBA PNG 是 Windows Tray 最低要求，缺失或损坏必须报错
function validateTrayIcon(skinId) {
  const fp = path.join(ASSETS, 'tray-icon.png');
  if (!fs.existsSync(fp)) {
    throw new Error(
      `tray-icon.png missing in ${path.join(skinId ? SKINS + '\\' + skinId + '\\frames' : ASSETS)}.\n` +
      `  Run: python skins/${skinId || '<skin>'}/make-tray.py  (or copy from another skin)\n` +
      `  Tray icon is REQUIRED — Windows tray won't show without it.`
    );
  }
  // 校验 PNG 头
  const buf = fs.readFileSync(fp).slice(0, 8);
  const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  if (!buf.equals(pngHeader)) {
    throw new Error(`tray-icon.png is not a valid PNG: ${fp}`);
  }
  // 校验尺寸：要求 32x32 (Windows tray 推荐尺寸)
  // PNG IHDR 在字节 16-23,宽高 4 字节大端
  const full = fs.readFileSync(fp);
  const width = full.readUInt32BE(16);
  const height = full.readUInt32BE(20);
  if (width < 16 || height < 16) {
    throw new Error(`tray-icon.png too small: ${width}x${height}, must be >= 16x16`);
  }
  if (width !== height) {
    console.warn(`  [warn] tray-icon.png is ${width}x${height} (not square) — Windows may scale oddly`);
  }
  return { width, height };
}

// --skin <id>: 从 skins/<id>/frames/ 复制到 assets/
// 关键：复制前先清空 assets/，避免上一个皮肤残留（如端午卜没有 wave 帧时残留倔强死神的 wave）
function applySkin(skinId) {
  const src = path.join(SKINS, skinId, 'frames');
  if (!fs.existsSync(src)) {
    console.error(`skin not found: ${src}`);
    process.exit(1);
  }
  console.log(`applying skin: ${skinId}`);

  // 先清空 assets/ 中所有 FRAMES 列表里的文件 + 历史遗留文件(STALE_FILES)
  if (fs.existsSync(ASSETS)) {
    const toClean = [...FRAMES.map(f => f.file), ...STALE_FILES];
    for (const file of toClean) {
      const dst = path.join(ASSETS, file);
      if (fs.existsSync(dst)) {
        fs.unlinkSync(dst);
      }
    }
  }

  for (const f of FRAMES) {
    const from = path.join(src, f.file);
    const to = path.join(ASSETS, f.file);
    if (!fs.existsSync(from)) {
      if (f.required) {
        // tray-icon 缺失: 直接报错(之前是 warn + 跳过, 导致 Windows tray 无显示)
        console.error(`  ERROR: required file missing: ${from}`);
        console.error(`  修复方法: python ${src}\\..\\make-tray.py (或从其他 skin 复制 tray-icon.png)`);
        process.exit(1);
      }
      // 非必需文件缺失是正常的(比如端午卜没有 wave 帧) —— 用 console.log 不是 warn,
      // 避免 Node $LASTEXITCODE 变 1 让 PowerShell 报"skip missing"红字
      console.log(`  [skip, optional] ${f.name} (${f.file})`);
      continue;
    }
    fs.copyFileSync(from, to);
    console.log(`  copied: ${f.name} (${f.file})`);
  }
}

// 扫描可用皮肤
// v1.9.1: 按 SKIN_ORDER 优先排序(用户偏好的显示顺序),未列出的按字母序追加
const SKIN_ORDER = ['端午卜', '阳光天使', '倔强死神'];

function listSkins() {
  if (!fs.existsSync(SKINS)) return [];
  const all = fs.readdirSync(SKINS, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  // 先按 SKIN_ORDER 排(只保留存在的)
  const ordered = SKIN_ORDER.filter(name => all.includes(name));
  // 剩余按字母序追加
  const remaining = all.filter(name => !SKIN_ORDER.includes(name)).sort();
  return [...ordered, ...remaining];
}

// 把 PNG 转 base64 写入 frames-embed.js
// tray-icon 不进 frames-embed（系统托盘走文件路径，不是 base64）
function bake() {
  // 校验 tray-icon 存在且是合法 PNG(否则 Windows 任务栏无图标)
  try {
    const info = validateTrayIcon();
    console.log(`  tray-icon.png: ${info.width}x${info.height} ✓`);
  } catch (e) {
    console.error(`[bake ERROR] ${e.message}`);
    process.exit(1);
  }

  const lines = ['// 自动生成（运行 scripts/bake-png.js 重新生成）'];
  lines.push('window.PET_FRAMES = {');
  for (const f of FRAMES) {
    if (f.name === 'tray-icon') continue;  // tray-icon 跳过 base64 打包
    const fp = path.join(ASSETS, f.file);
    if (!fs.existsSync(fp)) {
      // 同 applySkin: 用 console.log 不是 warn,避免 Node exit code = 1
      console.log(`  [skip, optional] ${f.name} not in assets`);
      continue;
    }
    const b64 = fs.readFileSync(fp).toString('base64');
    lines.push(`  ${f.name}: "data:image/png;base64,${b64}",`);
  }
  lines.push('};');
  lines.push('');
  fs.writeFileSync(OUT, lines.join('\n'));
  const sizes = FRAMES.map(f => `${f.name}=${fs.existsSync(path.join(ASSETS, f.file)) ? fs.statSync(path.join(ASSETS, f.file)).size : 0}`).join(', ');
  console.log(`baked: ${sizes} -> ${OUT}`);
}

// CLI
const args = process.argv.slice(2);
const skinIdx = args.indexOf('--skin');
let activeSkin = null;
if (skinIdx >= 0) {
  const skinId = args[skinIdx + 1];
  if (!skinId) {
    console.error('usage: bake-png.js --skin <skin-id>');
    process.exit(1);
  }
  activeSkin = skinId;
  applySkin(skinId);
}
if (args.includes('--list')) {
  console.log('available skins:');
  for (const s of listSkins()) console.log(`  ${s}`);
}
bake();

// 导出供 main.js 调用
module.exports = { listSkins, applySkin, bake };