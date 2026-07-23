"""看 pet-sleep.png 在 zongzi 左侧大片空白区的 alpha"""
from PIL import Image
import numpy as np

p = r'F:\MinMax Code\0629\desktop-pet\skins\端午卜\frames\pet-sleep.png'
img = Image.open(p)
print(f'模式: {img.mode}, size: {img.size}')

img_rgba = img.convert('RGBA')
arr = np.array(img_rgba)
h, w = arr.shape[:2]

# zongzi 主体在右侧 — 找 alpha=0 的左侧大片空白
# 抽样左半边的 alpha
print('\n左侧空白区 alpha 抽样:')
for y in [400, 600, 800, 1000, 1200, 1400, 1600]:
    for x in [50, 150, 250, 350, 450]:
        a = arr[y, x, 3]
        rgb = arr[y, x, :3]
        print(f'  ({x},{y}): alpha={a} rgb=({rgb[0]},{rgb[1]},{rgb[2]})')
    print()

# 主体 bbox —— 找 alpha>0 的中心
mask = arr[:, :, 3] > 0
ys, xs = np.where(mask)
print(f'\n主体 bbox: y={ys.min()}-{ys.max()}, x={xs.min()}-{xs.max()}')
print(f'主体中心 (mean): y={ys.mean():.0f}, x={xs.mean():.0f}')

# 看左侧大片空白的实际 alpha 值
print(f'\n左侧 x=50, y=400-1200 alpha:')
print(arr[400:1200:100, 50, 3])