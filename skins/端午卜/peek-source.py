"""直接看 pet-sleep.png 在(z=头的上方)位置的 RGB，看是不是本来就有 zongzi 装饰元素"""
from PIL import Image
import numpy as np

# 之前 v1.4 端午节用的 pet-sleep.png 是 matrix AI 出图
p = r'F:\MinMax Code\0629\desktop-pet\skins\端午卜\frames\pet-sleep.png'
img = Image.open(p).convert('RGBA')
arr = np.array(img)
h, w = arr.shape[:2]
print(f'pet-sleep.png: {w}x{h}')

# 在 y=80-200, x=900-1100 之间查找白色像素
# (假定 zongzi 在中央 ~1024)
print('\nzongzi 主体顶部上方区域的 RGB (y=80-200, x=900-1100):')
for y in range(80, 250, 30):
    for x in range(900, 1100, 30):
        rgb = arr[y, x]
        alpha = arr[y, x, 3]
        if rgb[3] > 0:
            print(f'  ({x},{y}): rgb=({rgb[0]},{rgb[1]},{rgb[2]}) alpha={alpha}')