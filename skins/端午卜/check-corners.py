"""检查 pet-sleep.png 各个角落的颜色"""
from PIL import Image
import numpy as np

p = r'F:\MinMax Code\0629\desktop-pet\skins\端午卜\frames\pet-sleep.png'
img = Image.open(p).convert('RGBA')
arr = np.array(img)
h, w = arr.shape[:2]

print('四角的 RGB (y, x):')
for y, x in [(0, 0), (0, w-1), (h-1, 0), (h-1, w-1), (h//2, 0), (0, w//2)]:
    print(f'  ({y},{x}): rgb=({arr[y,x,0]},{arr[y,x,1]},{arr[y,x,2]}) alpha={arr[y,x,3]}')

print('\n边缘 y=0 alpha=0 像素数:', (arr[0, :, 3] == 0).sum())
print('边缘 y=h-1 alpha=0 像素数:', (arr[h-1, :, 3] == 0).sum())
print('边缘 x=0 alpha=0 像素数:', (arr[:, 0, 3] == 0).sum())
print('边缘 x=w-1 alpha=0 像素数:', (arr[:, w-1, 3] == 0).sum())

# 看 alpha=0 像素的 RGB
zero_mask = arr[:, :, 3] == 0
zero_rgb = arr[zero_mask][:, :3]
if len(zero_rgb) > 0:
    print(f'\nalpha=0 像素 RGB 范围:')
    print(f'  R: {zero_rgb[:, 0].min()}-{zero_rgb[:, 0].max()}, G: {zero_rgb[:, 1].min()}-{zero_rgb[:, 1].max()}, B: {zero_rgb[:, 2].min()}-{zero_rgb[:, 2].max()}')
    print(f'  avg: ({zero_rgb[:, 0].mean():.0f}, {zero_rgb[:, 1].mean():.0f}, {zero_rgb[:, 2].mean():.0f})')