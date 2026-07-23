"""检查端午 pet-sleep.png alpha 分布"""
from PIL import Image
import numpy as np

p = r'F:\MinMax Code\0629\desktop-pet\skins\端午卜\frames\pet-sleep.png'
img = Image.open(p)
print(f'size: {img.size}, mode: {img.mode}')

if img.mode != 'RGBA':
    img = img.convert('RGBA')
arr = np.array(img)
alpha = arr[:, :, 3]
print(f'alpha=0: {(alpha == 0).sum()} ({(alpha == 0).sum() / alpha.size * 100:.1f}%)')
print(f'alpha=255: {(alpha == 255).sum()} ({(alpha == 255).sum() / alpha.size * 100:.1f}%)')
print(f'alpha 1-254: {((alpha > 0) & (alpha < 255)).sum()}')

# 看主图周围 50px 区域，alpha 是什么
print('\n边缘区域 alpha:')
for y in [50, 100, 200, 500, 1000, 1500, 1800, 1900, 2000]:
    row_alpha = alpha[y]
    zero_count = (row_alpha == 0).sum()
    partial_count = ((row_alpha > 0) & (row_alpha < 255)).sum()
    full_count = (row_alpha == 255).sum()
    print(f'  y={y:4d}: zero={zero_count:5d}, partial={partial_count:5d}, full={full_count:5d}')

# 看 y=1800 这一行（接近底部）的 alpha 值
print('\ny=1800 详细 alpha 值 (sampled):')
for x in range(0, 1920, 100):
    print(f'  x={x:4d}: alpha={alpha[1800, x]}')