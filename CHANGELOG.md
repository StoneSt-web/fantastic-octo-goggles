# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-22

### 🎉 首个稳定版本

#### 核心功能
- 桌宠显示、拖动、眨眼、自动睡眠(3 分钟无操作)
- 5 帧状态:idle / blink / sleep / sing / wave
- 3 套皮肤(内置,可切换):
  - 端午卜(zongzi)
  - 阳光天使(angel)
  - 倔强死神(reaper)
- 皮肤切换不 reload 窗口(无闪烁)

#### 气泡系统
- 打字机效果(默认 65ms/字,可调)
- 7 套气泡词库(五月天歌词/默认/经典/古风/节日/状态/档案)
- 气泡学习(❤️/✕ 反馈,score<0 自动隐藏)
- 自定义金句 + 纪念日

#### 鼠标互动 (v1.10)
- 凑近效果(translateX + rotate)
- 歪头效果(near-tilt, 50% 概率 3s 冷却)
- 躲避(dodge, 1.5s 冷却)

#### 启动问候 (v1.9)
- 时段(早安/午安/晚安)
- 节日(春节/端午/中秋/圣诞/...)
- 生日 / 纪念日
- 天气(自动 IP 定位 + 实时气温/湿度/风)
- 星座运势(30% 概率混入)

#### 设置面板 (v1.7)
- 7 控件:频率/打字机/词库/自启/位置/尺寸/统计
- 等级系统(总互动次数升级)
- 拟人化(名字替换"我" + 性别后缀 + MBTI 调整)

#### 宠物档案 (v1.8)
- 姓名/生日/星座/性别/MBTI
- 生日 / 星座运势

#### 定时通知 (v1.13)
- 🍅 番茄钟:25min 工作 + 5min 休息循环,庆祝动画
- 💧 喝水提醒:60min 间隔
- 🪑 久坐提醒:60min 间隔
- 设置面板可调所有间隔

#### 鼠标互动彩蛋
- click 触发 dodge + 飘爱心
- 右键菜单 11 项:打招呼/唱歌/笑/比心/朗读/睡觉/番茄/喝水/久坐/加金句/加纪念日

#### 系统集成
- 系统托盘(单击显隐 + 退出)
- 开机自启(可选)
- 多显示器支持(记住窗口位置)
- 窗口缩放 0.8-1.2x

#### 性能
- 5 帧 PNG 1024x1024(总 5MB,加载后缓存)
- frames-embed.js 内联 base64(切换皮肤 0 网络请求)

### 已废弃
- TTS 朗读(代码保留,UI 隐藏,后续版本可能恢复)

### 已知问题
- 透明窗口下 `<audio>` 元素静默失败(TTS 走主进程 sound-play 解决)
- Win32 DWM 对 alpha=0 + RGB 非零像素会显示棋盘格(已用 reset-zero-rgb 解决)
- CSP 默认禁 eval(已加 'unsafe-eval')
- macOS 未测试

### 技术栈
- Electron 32
- 3 套皮肤(PNG + BFS 抠图 + bbox 对齐)
- edge-tts-universal(微软神经语音,可关)
- sound-play(主进程 TTS 播放)
- 原生 HTML/CSS/JS(无前端框架)

---

## [0.x] - 历史版本

未公开发布,v0.x 是开发期内部迭代。

主要开发里程碑:
- 2026-07-04:首个完整 Electron 透明窗口桌宠
- 2026-07-05:气泡系统 + 鼠标互动初版
- 2026-07-06:皮肤切换 + Win32 DWM 棋盘格 fix
- 2026-07-07:settings 窗口 + 宠物档案
- 2026-07-08:启动问候 + 天气
- 2026-07-09:TTS 框架
- 2026-07-10:edge-tts 集成(后被用户搁置)
- 2026-07-16:定时通知 v1.13(番茄钟/喝水/久坐)
- 2026-07-22:v1.0.0 发布准备
