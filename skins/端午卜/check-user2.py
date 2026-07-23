"""从用户截图分析 zongzi 周围的棋盘格"""
from PIL import Image
import numpy as np

src = r'C:\Users\12690\.mavis\uploads\1783428548152-image.png'
img = Image.open(src).convert('RGB')
print(f'size: {img.size}')
arr = np.array(img)
h, w = arr.shape[:2]

# zongzi 周围黑色区域抽几个像素（看是不是纯黑）
print('\n黑色背景区域 RGB:')
for y, x in [(100, 100), (200, 200), (500, 500), (300, 800), (200, 1200)]:
    print(f'  ({x},{y}): rgb={tuple(arr[y, x])}')

# zongzi 周围"棋盘格"区域（在中下部）
print('\nzongzi 周围像素:')
# 截图大概 1878×1040，zongzi 在中间 (770, 600) 左右
for y in range(400, 850, 50):
    for x in range(550, 1100, 50):
        rgb = arr[y, x]
        print(f'  ({x},{y}): rgb={tuple(rgb)}')