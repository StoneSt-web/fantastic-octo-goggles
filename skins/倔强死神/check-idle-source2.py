"""倔强死神 idle PNG 重新抠图 —— 修复左翅膀+左镰刀缺失。

原 pet-original.png 是 AI 出的睁眼微笑版，白底。
原抠图阈值 (sat < 30 & avg > 220) 太严 → 左翅膀外侧浅色羽毛被当背景删了。

修复：
1. 用更宽松阈值 (sat < 15 & avg > 240) → 保留左翅膀+左镰刀外侧
2. 缩放居中到 2048x2048 → 输出 frames/pet.png
"""
from PIL import Image
import numpy as np
from collections import deque

# 倔强死神 idle 源图 (睁眼微笑)
# pet-original.png (1MB) 是 AI 出图原始 —— 但已经是抠图后的版本
# 真正的源图应该是更早的：可能是 matrix 出图的某张
# 让我先尝试 pet-original.png (假设它就是睁眼版的抠图源)

# 等等，pet-original.png 是 v1 抠图版本，1MB 不是源 AI 图（源是 1920x1920 = 3MB+）
# 所以需要找原始 AI 出图

import os
# 列出 uploads 候选
candidates = [
    r"C:\Users\12690\.mavis\uploads\1783343364098-image.png",  # 7/6 21:09
    r"C:\Users\12690\.mavis\uploads\1783342601864-image.png",  # 7/6 20:56
    r"C:\Users\12690\.mavis\uploads\1783332285412-image.png",  # 7/6 18:04
]
for c in candidates:
    if os.path.exists(c):
        try:
            img = Image.open(c)
            print(f'{c.split(chr(92))[-1]}: {img.size} {img.mode}')
        except:
            pass

# 没有的话，就用 pet-original.png 抠图（已经是睁眼微笑版抠图）
SRC = r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-original.png"
print(f'\nUsing: {SRC}')
img = Image.open(SRC).convert('RGBA')
print(f'Size: {img.size}, mode: {img.mode}')

# 查看 pet-original.png 的样子 - 如果它是睁眼微笑，那就直接抠
# 如果它已经有抠图痕迹（alpha 不均匀），就需要重新 AI 出图