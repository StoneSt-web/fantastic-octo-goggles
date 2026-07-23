# 端午卜皮肤（粽子桌宠）

v1.4 桌面宠物应用的第一个皮肤，主题为端午节粽子。

## 角色设计
- 主体：橙色圆脸粽子
- 装饰：竹叶帽 + 龙脸（帽上）+ 麻绳腰带 + 中国结 + 红色流苏

## 帧清单（v1.4）

| 帧文件 | 用途 | 触发条件 |
|---|---|---|
| `frames/pet.png` | idle 默认睁眼 | 默认 |
| `frames/pet-eye-closed.png` | blink 眯眼笑 | 5-10s 周期眨眼（280ms hold） |
| `frames/pet-sleep.png` | sleep 闭眼 + 胡须嘴 | 睡觉 action |
| `frames/pet-sing.png` | sing 张嘴无音符 | 歌词气泡（text 含 ｜） |
| `frames/pet-surprised.png` | surprised 小圆嘴 | 备用 |
| `frames/pet-original.png` | 原始未修改的底图 | 重新制作时参考 |
| `frames/tray-icon.png` | 系统托盘图标（32×32） | 托盘 |

## Prompt 模板

放在 `prompts/` 子目录里：

- `gen-sleep-prompt.json` — AI 重绘闭眼版本的 prompt
- `gen-sing-prompt.json` — AI 重绘张嘴版本的 prompt
- `gen-surprised-prompt.json` — AI 重绘惊讶版本的 prompt

每个 prompt 文件都使用 `input_files: [pet.png]` 作为参考图，**关键技巧**：
- "Make ONLY one change" + 完整保留元素清单
- "Do NOT add any music notes / sparkles / extra decorations"（PNG 缩到 136×136 后看不清）
- "Output as clean PNG with transparent background"

## 如何换皮肤

1. 用 AI 出 5 帧 + 1 个 tray 图标（基于新角色设计的 input_files）
2. 把 PNG 放到 `skins/<new-skin>/frames/` 目录
3. 把新 prompt 模板放到 `skins/<new-skin>/prompts/` 目录（可选）
4. 更新 `scripts/bake-png.js` 的 FRAMES 数组指向新路径（参考此皮肤的 FRAMES 配置）
5. 运行 `node scripts/bake-png.js` 重新生成 `frames-embed.js`

## 制作过程文档

详见主项目 memory（`C:\Users\12690\.mavis\agents\mavis\memory\MEMORY.md`）里的相关 entries：
- 桌宠 v1.4 闭眼 PNG 三轮迭代
- 桌宠 v1.4 PNG 抠图最终方案
- 桌宠 v1.4 唱歌 PNG 复用成功 prompt
- 桌宠 v1.4 动画状态互斥

## PNG 抠图工具

v1.4 用的抠图工具（通用，未来换皮可复用）：
- `scripts/bake-png.js` — 把 PNG 转 base64 嵌入 `frames-embed.js`
- `scripts/make-sleep-png.py` — 程序化 fallback（不推荐，AI 出图更自然）
- `scripts/make-tray-icon.py` — 生成托盘图标

## 关键参数

- 窗口：425 × 204 px
- hitArea：136 × 136 px
- 角色 PNG：2048 × 2048（缩到 136×136 显示）
- 气泡：140 px 宽，font 11px（中文可读下限）
- 打字机速度：65 ms/字
- 眨眼：280 ms hold
- 睡觉：5 秒

## 验证流程

```powershell
cd "F:\MinMax Code\0629\desktop-pet"; npm start
```

验证清单：
- [ ] 眨眼周期 5-10s，280ms hold
- [ ] 睡觉 5 秒，期间不眨眼，醒来眨眼一次
- [ ] 歌词气泡触发 sing 帧
- [ ] 拖动气泡跟随
- [ ] 系统托盘：隐藏/显示/退出