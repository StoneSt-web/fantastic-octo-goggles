"""统一所有 5 帧的 bbox —— 以 idle (pet.png) 为基准。

目标 bbox (跟 idle 一致):
  x=[52,1997] y=[155,1931] in 2048x2048 canvas
  - bbox size: 1945x1776
  - top margin: 155, bottom margin: 116
  - left margin: 52, right margin: 50

对每帧: 抠图 + bbox 缩放 + 居中到 idle 的位置
"""
from PIL import Image
import numpy as np
from collections import deque

# Idle 基准
IDLE_BBOX_W = 1945
IDLE_BBOX_H = 1776
IDLE_TOP = 155
IDLE_BOTTOM = 116
IDLE_LEFT = 52
IDLE_RIGHT = 50
CANVAS = 2048

# 帧配置 (源图, 目标文件)
# 注意: 这些是已经抠图好的 PNG (2048x2048 RGBA) —— 但 bbox 跟 idle 不一致
FRAMES_TO_ALIGN = [
    ('sleep', r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-sleep.png"),
    ('sing', r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-sing.png"),
    ('wave', r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-wave.png"),
]

def re_align(name, path):
    img = Image.open(path).convert('RGBA')
    arr = np.array(img)
    alpha = arr[:, :, 3]

    # 找主体 bbox (alpha > 10)
    mask = alpha > 10
    ys, xs = np.where(mask)
    if len(ys) == 0:
        print(f'{name}: ERROR no visible content')
        return
    bbox = (xs.min(), ys.min(), xs.max(), ys.max())
    bbox_w = bbox[2] - bbox[0]
    bbox_h = bbox[3] - bbox[1]
    print(f'{name}: 原始 bbox {bbox_w}x{bbox_h}')

    # 裁剪主体
    cropped = arr[bbox[1]:bbox[3]+1, bbox[0]:bbox[2]+1]
    cw, ch = cropped.shape[1], cropped.shape[0]

    # 缩放: 让 bbox 跟 idle 一致
    # 用高度作为缩放基准 (因为各帧主体高度可能不同)
    scale = IDLE_BBOX_H / ch
    new_w = int(cw * scale)
    new_h = IDLE_BBOX_H
    cropped_img = Image.fromarray(cropped)
    resized = cropped_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    print(f'  scale: {scale:.3f}, new size: {new_w}x{new_h}')

    # 创建 canvas
    canvas = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    # 居中到 idle 位置
    x = (CANVAS - new_w) // 2  # 水平居中
    y = IDLE_TOP  # 垂直对齐 idle 顶部
    canvas.paste(resized, (x, y), resized)
    canvas.save(path)
    print(f'  saved: {path}')

    # 验证
    out = np.array(canvas)
    mask = out[:, :, 3] > 10
    ys2, xs2 = np.where(mask)
    print(f'  new bbox: x=[{xs2.min()},{xs2.max()}] y=[{ys2.min()},{ys2.max()}]')
    print(f'  top: {ys2.min()}, bottom: {CANVAS - 1 - ys2.max()} (target top={IDLE_TOP}, bottom={IDLE_BOTTOM})')
    print()

for name, path in FRAMES_TO_ALIGN:
    re_align(name, path)

print('=== 验证: 全部 5 帧对齐 ===')
all_frames = [
    ('idle', r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet.png"),
    ('blink', r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-eye-closed.png"),
    ('sleep', r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-sleep.png"),
    ('sing', r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-sing.png"),
    ('wave', r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-wave.png"),
]
print(f'{"name":<6} {"bbox_w":<7} {"bbox_h":<7} {"top":<5} {"bot":<5} {"left":<5} {"right":<5}')
for name, path in all_frames:
    arr = np.array(Image.open(path).convert('RGBA'))
    m = arr[:, :, 3] > 10
    ys, xs = np.where(m)
    print(f'{name:<6} {xs.max()-xs.min():<7} {ys.max()-ys.min():<7} {ys.min():<5} {arr.shape[0]-1-ys.max():<5} {xs.min():<5} {arr.shape[1]-1-xs.max():<5}')