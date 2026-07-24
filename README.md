# 🐾 WMLS的桌面伴侣 Desktop Pet

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/StoneSt-web/fantastic-octo-goggles)](https://github.com/StoneSt-web/fantastic-octo-goggles/releases/latest)
[![GitHub downloads](https://img.shields.io/github/downloads/StoneSt-web/fantastic-octo-goggles/total)](https://github.com/StoneSt-web/fantastic-octo-goggles/releases)
[![GitHub stars](https://img.shields.io/github/stars/StoneSt-web/fantastic-octo-goggles)](https://github.com/StoneSt-web/fantastic-octo-goggles/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform: Win/macOS](https://img.shields.io/badge/Platform-Win%20%7C%20macOS-blue)]()

> 一只养在桌面上的萌系虚拟宠物 — 会眨眼/会说话/陪你番茄钟 🐾

![demo](docs/demo.gif)
*（5 秒 GIF: 桌宠走动 + 气泡 + 躲避鼠标 + 切换皮肤。生成命令见文末「截图指南」）*

---

## ✨ 它能干什么

| 🐰 形象 | 💬 互动 | 🍅 实用 |
|---|---|---|
| 3 套皮肤(端午卜 / 阳光天使 / 倔强死神) | 五月天歌词 + 默认词库 + 节日问候 | 番茄钟 25+5min |
| 5 帧动画(idle / 眨眼 / 睡觉 / 唱歌 / 挥手) | 凑近歪头 + 点击 dodge + 飘爱心 | 喝水/久坐提醒 |
| 切换皮肤**不重启窗口** | 启动问候 + 天气 + 生日祝福 | 纪念日提前 1 天提醒 |
| PNG 透明 + 毛绒治愈风 | 自定义金句 + 朗读(已搁置) | 等级系统 + 统计 |

---

## 🚀 30 秒上手

### 方式一:下载安装包(推荐)

去 [Releases](https://github.com/StoneSt-web/fantastic-octo-goggles/releases/latest) 下载对应版本:
- 🪟 **Windows**: `桌面宠物-1.0.0-setup.exe` (≈ 115 MB)
- 🍎 **macOS (Apple Silicon)**: `桌面宠物-1.0.0-arm64.dmg` (≈ 134 MB)

> ⚠️ macOS Intel 暂未出包,需要的话提 issue

### 方式二:从源码跑(开发者)

```bash
git clone https://github.com/StoneSt-web/fantastic-octo-goggles.git
cd fantastic-octo-goggles
npm install
npm start
```

要求 Node.js 18+。

---

## 📸 截图

> 截图都放在 `docs/screenshots/`。动态截图待补,先用 pet 形象占位。

### 🎨 3 套皮肤一览

| 端午卜(默认) | 阳光天使 | 倔强死神 |
|---|---|---|
| ![zongzi](docs/screenshots/01-pet-zongzi.png) | ![angel](docs/screenshots/02-pet-angel.png) | ![shinigami](docs/screenshots/03-pet-shinigami.png) |

### 动态效果(待补截图/GIF)

| 主界面 | 鼠标凑近 | 切换皮肤 |
|---|---|---|
| _待补_ | _待补_ | _待补_ |

| 气泡 | 番茄钟 | 设置面板 |
|---|---|---|
| _待补_ | _待补_ | _待补_ |

---

## 🖱️ 使用

### 基础操作

| 操作 | 效果 |
|---|---|
| **左键拖动** | 移动桌宠 |
| **左键单击** | dodge(躲闪 + 飘爱心) |
| **右键** | 打开 11 项菜单 |
| **双击托盘** | 显隐切换 |

### 鼠标互动彩蛋

- 距离 < 100px:桌宠**凑近躲闪**
- 距离 80-180px:50% 概率**歪头** 1.5 秒
- 点击桌宠:**dodge + 飘爱心**

### 右键菜单速查

| 菜单 | 说明 |
|---|---|
| 👋 打个招呼 | 强制出气泡 |
| 🎤 让它唱首歌 | 切 sing 帧 + 五月天 |
| 😊 让它笑一下 | 眯眼 + 出气泡 |
| 💖 比心 | 飘爱心 |
| 😴 让它睡觉 | 切 sleep 帧 + 5s 醒来 |
| 🍅 番茄钟 | 开始/停止 25+5min |
| 💧 我刚喝过水 | 重置喝水计时 |
| 🪑 我起来活动 | 重置久坐计时 |
| ✏️ 加一句金句 | 自定义金句 |
| 📅 加纪念日 | 提醒当天 / 提前 1 天 |
| ⚙️ 设置 | 打开设置窗口 |

### 系统托盘

- **单击**:显隐桌宠
- **右键**:退出 / 切换皮肤 / 设置

---

## 🎨 皮肤

| 皮肤 | 风格 |
|---|---|
| 🌿 **端午卜** | 粽子造型,节日限定(端午节) |
| 😇 **阳光天使** | 白色翅膀 + 治愈系 |
| 💀 **倔强死神** | 黑色斗篷 + 反差萌 |

托盘 → 切换皮肤 / 右键 → 切换皮肤。**瞬间切换,不重启**。

---

## ⚙️ 设置

右键 → ⚙️ 设置,5 个 section:

1. **基础**:气泡频率 / 主题 / 打字机速度 / 缩放 / 开机自启 / 记住位置
2. **系统**:托盘 / 窗口位置
3. **档案**:姓名 / 生日 / 星座 / 性别 / MBTI
4. **天气**:城市 / 自动定位
5. **定时通知**(v1.13):番茄钟 / 喝水 / 久坐

---

## 🛠️ 开发

### 项目结构

```
desktop-pet/
├── src/
│   ├── main.js              # 主进程(IPC / 托盘 / 调度)
│   ├── preload.js           # 桌宠 preload
│   ├── preload-settings.js  # 设置窗口 preload
│   └── renderer/
│       ├── renderer.js      # 桌宠逻辑
│       ├── settings.js      # 设置逻辑
│       ├── style.css        # 桌宠样式
│       └── frames-embed.js  # 5 帧 base64(自动生成)
├── scripts/
│   ├── bake-png.js          # PNG → frames-embed.js
│   ├── notifications.js     # 番茄钟/喝水/久坐调度
│   ├── settings.js          # settings.json 读写
│   ├── edge-tts.js          # TTS wrapper(已搁置)
│   └── make-tray.py         # tray-icon 生成
├── skins/                   # 3 套皮肤素材
├── assets/                  # bake 后的运行时素材
├── build/                   # 应用图标
└── package.json
```

### 命令

| 命令 | 作用 |
|---|---|
| `npm start` | 启动桌宠 |
| `npm run dev` | 启动 + stdout/stderr 日志 |
| `npm run bake` | 重新 bake frames(换皮肤后) |
| `npm run pack` | 打包成未压缩目录 |
| `npm run dist` | 打包成安装包 |
| `npm run dist:win` | 只打 Windows |
| `npm run dist:mac` | 只打 macOS |

### 添加新皮肤

1. 在 `skins/<name>/frames/` 放 5 个 PNG:
   - `pet.png` (idle 睁眼)
   - `pet-eye-closed.png` (blink 闭眼)
   - `pet-sleep.png` (sleep 闭眼 + Zzz)
   - `pet-sing.png` (sing 唱歌)
   - `pet-wave.png` (wave 挥手)
   - `tray-icon.png` (32×32 透明)
2. PNG 必须 alpha 透明(用 BFS floodfill 抠图)
3. 跑 `npm run bake`
4. 重启桌宠,皮肤出现在菜单

---

## 🐛 常见问题

<details>
<summary><b>桌宠消失了?</b></summary>

找系统托盘(右下角),单击图标显示。或右键托盘 → 退出 → 重启。
</details>

<details>
<summary><b>设置面板没看到 TTS 朗读?</b></summary>

TTS 朗读(v1.11)代码已实现,UI 暂时隐藏。后续 v1.15+ 计划重新开放。
</details>

<details>
<summary><b>桌宠穿透点击 / 鼠标失灵?</b></summary>

双击 / 单击托盘图标(显隐一次可重置),或重启桌宠。
</details>

<details>
<summary><b>macOS 上有 bug?</b></summary>

PR 欢迎 — 当前 macOS 仅做了构建,没在真机实测过。
</details>

---

## 🤝 贡献

欢迎 PR / Issue / Star ⭐

- 提 Bug:[issue](https://github.com/StoneSt-web/fantastic-octo-goggles/issues/new?template=bug.md)
- 提需求:[feature request](https://github.com/StoneSt-web/fantastic-octo-goggles/issues/new?template=feature.md)
- 提交皮肤:见上文「添加新皮肤」

---

## 📜 License

[MIT](LICENSE) — 自由使用,欢迎二次开发。

---

## 🙏 致谢

- 🐾 微软 edge-tts(免费神经语音)
- 🎵 五月天(歌词语料库,感谢阿信)
- 🛠️ [Electron 32](https://www.electronjs.org/)
- 🎨 [electron-builder](https://www.electron.build/)

---

## 📸 截图生成指南

```bash
# 1. 录 GIF(推荐用 ScreenToGif 或 Kap)
#    - 启动桌宠 → 移动 + 点击 + 切换皮肤 → 录 5-10 秒
#    - 存为 docs/demo.gif

# 2. 动态截图(Win+Shift+S 或 Cmd+Shift+4)
#    - 04-main.png       — 桌宠空闲
#    - 05-hover.png      — 鼠标凑近
#    - 06-skin.png       — 切换皮肤过渡
#    - 07-bubble.png     — 出气泡
#    - 08-pomodoro.png   — 番茄钟工作
#    - 09-settings.png   — 设置窗口

# 注意:01-03 已被 pet.png 占用,动态截图从 04 开始命名
```

放在 `docs/screenshots/` 目录,README 里的图片链接自动生效。
