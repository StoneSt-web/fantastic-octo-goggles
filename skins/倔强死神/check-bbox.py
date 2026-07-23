"""检查 pet-sing.png 的 alpha bbox"""
from PIL import Image
import numpy as np

img = Image.open(r'F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-sing.png').convert('RGBA')
arr = np.array(img)
print('size:', img.size)

alpha = arr[:, :, 3]
mask = alpha > 10
ys, xs = np.where(mask)
if len(ys) == 0:
    print('no visible pixels')
else:
    print(f'bbox: x=[{xs.min()},{xs.max()}], y=[{ys.min()},{ys.max()}]')
    print(f'bbox height={ys.max() - ys.min() + 1}, width={xs.max() - xs.min() + 1}')
    print(f'top margin: {ys.min()}px, bottom margin: {2047 - ys.max()}px')
    print(f'left margin: {xs.min()}px, right margin: {2047 - xs.max()}px')
    print(f'occupies: {(mask.sum() / mask.size) * 100:.1f}% of canvas')