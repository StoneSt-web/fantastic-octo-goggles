# 🐾 桌面宠物 (Desktop Pet)

一只养在桌面上的萌系小宠物,基于 Electron 32。Windows / macOS 跨平台。

## ✨ 功能

- 🐰 **3 套皮肤自由切换**:端午卜 / 阳光天使 / 倔强死神
- 💬 **气泡陪你聊天**:五月天歌词 + 默认词库 + 节日问候 + 自定义金句
- 🍅 **番茄钟**:25min 工作 + 5min 休息循环,完成有庆祝动画
- 💧 **喝水 / 久坐提醒**:每小时自动提醒
- 🖱️ **鼠标互动**:凑近 / 歪头 / 躲避 / 飘爱心
- ⏰ **启动问候**:早上好 / 节日快乐 / 生日祝福 + 实时天气
- 🎯 **个性化**:档案(姓名/生日/星座/性别/MBTI) + 等级系统
- 🪟 **系统托盘**:单击显隐,右键菜单完整功能
- 📊 **统计**:总点击 / 拖动 / 气泡 / 今日番茄

## 📸 截图

(主界面: 桌宠 + 气泡 + 鼠标互动)

## 🚀 安装

### 方式一:下载安装包(推荐)

前往 [Releases](https://github.com/StoneSt-web/fantastic-octo-goggles/releases) 下载:
- Windows:`desktop-pet-1.0.0-setup.exe`
- macOS:`desktop-pet-1.0.0.dmg`

### 方式二:从源码运行

需要 Node.js 18+ 和 npm:

```bash
git clone https://github.com/StoneSt-web/fantastic-octo-goggles.git
cd fantastic-octo-goggles
npm install
npm start
```

## 🖱️ 使用

### 基础操作
- **左键拖动**:移动桌宠
- **左键单击**:触发 dodge(躲避 + 飘爱心)
- **右键**:打开菜单(11 项功能)

### 右键菜单
| 操作 | 说明 |
|---|---|
| 👋 打个招呼 | 强制出气泡 |
| 🎤 让它唱首歌 | 切到 sing 帧 + 唱五月天 |
| 😊 让它笑一下 | 眯眼 + 出气泡 |
| 💖 比心 | 飘爱心动画 |
| 🔊 朗读这条 | (TTS 已搁置) |
| 😴 让它睡觉 | 切到 sleep 帧 + 5s 醒来 |
| 🍅 番茄钟 | 开始/停止 25+5min 循环 |
| 💧 我刚喝过水 | 重置喝水计时 |
| 🪑 我起来活动 | 重置久坐计时 |
| ✏️ 加一句金句 | 自定义金句(可被选为气泡) |
| 📅 加纪念日 | 提醒当天 / 提前 1 天 |

### 系统托盘
- **单击**:显隐桌宠
- **右键**:退出 / 切换皮肤 / 设置

### 鼠标互动彩蛋
- **凑近**:鼠标距桌宠 < 100px → 桌宠躲闪方向平移
- **歪头**:距离 80-180px 时 50% 概率歪头 1.5s
- **躲避**:点击桌宠时自动 dodge 飘爱心

## ⚙️ 设置

右键菜单 → ⚙️ 设置(或托盘 → 设置),包含 5 个 section:

1. **基础设置**:气泡频率 / 主题 / 打字机速度 / 缩放 / 开机自启 / 记住位置
2. **系统**:系统托盘 / 窗口位置
3. **宠物档案**:姓名 / 生日 / 星座 / 性别 / MBTI
4. **天气**:城市 / 自动定位
5. **定时通知**(v1.13):番茄钟开关 / 工作时长 / 休息时长 / 喝水开关 / 喝水间隔 / 久坐开关 / 久坐间隔

## 🎨 切换皮肤

托盘 → 切换皮肤,或右键菜单 → 切换皮肤。

3 套皮肤:
- **端午卜**:粽子造型,节日限定
- **阳光天使**:白色翅膀 + 治愈系
- **倔强死神**:黑色斗篷 + 反差萌

切换皮肤**不重启窗口**,瞬间完成。

## 🛠️ 开发

### 环境要求
- Node.js 18+
- npm
- Windows 10+ 或 macOS 11+

### 项目结构

```
desktop-pet/
├── src/                    # Electron 主进程 + 渲染层
│   ├── main.js             # 主进程(IPC / 托盘 / 窗口 / 调度)
│   ├── preload.js          # 桌宠 preload
│   ├── preload-settings.js # 设置窗口 preload
│   └── renderer/
│       ├── index.html      # 桌宠 HTML
│       ├── renderer.js     # 桌宠逻辑
│       ├── style.css       # 桌宠样式
│       ├── settings.html   # 设置窗口 HTML
│       ├── settings.js     # 设置逻辑
│       ├── settings.css    # 设置样式
│       └── frames-embed.js # bake 出的 5 帧 base64(自动生成)
├── scripts/                # 工具脚本
│   ├── bake-png.js         # PNG → frames-embed.js
│   ├── notifications.js    # 番茄钟/喝水/久坐调度器
│   ├── settings.js         # settings.json 读写
│   ├── edge-tts.js         # TTS wrapper(已搁置,代码保留)
│   └── make-tray.py        # tray-icon 生成
├── skins/                  # 3 套皮肤素材
│   ├── 端午卜 /frames/
│   ├── 阳光天使/frames/
│   └── 倔强死神/frames/
├── assets/                 # bake 后的运行时素材(自动生成)
├── build/                  # 应用图标(打包用)
├── package.json
├── CHANGELOG.md
├── LICENSE
└── README.md
```

### 命令

```bash
npm start              # 启动桌宠
npm run dev            # 启动 + 开启 stdout/stderr 日志
npm run bake           # 重新 bake frames(切换皮肤后)
npm run pack           # 打包成未压缩目录(dist/win-unpacked/)
npm run dist           # 打包成安装包(dist/*.exe)
npm run dist:win       # 只打 Windows
npm run dist:mac       # 只打 macOS
```

### 添加新皮肤

1. 在 `skins/<name>/frames/` 放 5 个 PNG:
   - `pet.png` (idle 睁眼)
   - `pet-eye-closed.png` (blink 闭眼)
   - `pet-sleep.png` (sleep 闭眼 + Zzz)
   - `pet-sing.png` (sing 唱歌)
   - `pet-wave.png` (wave 挥手)
   - `tray-icon.png` (32x32 透明 PNG)
2. 命名要 alpha=0 透明(用 BFS floodfill 抠图)
3. 跑 `npm run bake`
4. 重启桌宠,皮肤出现在菜单

## 🐛 常见问题

### 桌宠消失了?

- 找系统托盘(右下角),单击图标显示
- 或右键托盘 → 退出 → 重启

### 设置面板没显示 TTS 朗读?

TTS 朗读(v1.11)代码已实现,但**当前版本 UI 隐藏**(v1.11.5 之后)。
后续 v1.15+ 计划优化后重新开放。

### 桌宠穿透点击 / 鼠标失灵?

- 双击 / 单击托盘图标(显隐一次可重置)
- 重启桌宠

### macOS 上有未测试问题?

PR 欢迎 — 当前未在 macOS 实测过。

## 📜 License

MIT — 见 [LICENSE](LICENSE)

## 🙏 致谢

- 微软 edge-tts(免费神经语音)
- Electron 32
- 五月天(歌词语料库)
