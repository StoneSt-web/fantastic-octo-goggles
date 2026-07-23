"""看截图里 zongzi 周围的"棋盘格"区域"""
from PIL import Image
import numpy as np

src = r'C:\Users\12690\.mavis\uploads\1783428548152-image.png'
img = Image.open(src).convert('RGB')
arr = np.array(img)
h, w = arr.shape[:2]

# 看几个棋盘格位置的 RGB
print(f'size: {w}x{h}')
# zongzi 周围"棋盘格"区：大致中下部分
print('\n棋盘格区域像素 (zongzi 左/右/上 边缘):')
# 大概位置 (zongzi 在中央)
positions = [
    (305, 200), (310, 220), (315, 240),  # 左
    (490, 200), (500, 220), (505, 240),  # 右
    (380, 150), (400, 160), (420, 165),  # 上
    (380, 380), (400, 380), (420, 380),  # 下
]
for y, x in positions:
    if y < h and x < w:
        rgb = arr[y, x]
        print(f'  ({x},{y}): rgb={tuple(rgb)}')