"""单独看一下 pet-sleep.png 是否有任何 alpha=1-254 像素"""
from PIL import Image
import numpy as np

p = r'F:\MinMax Code\0629\desktop-pet\skins\端午卜\frames\pet-sleep.png'
img = Image.open(p).convert('RGBA')
arr = np.array(img)
alpha = arr[:, :, 3]
print(f'文件大小: {len(open(p, "rb").read())} bytes')
print(f'alpha=0: {(alpha == 0).sum()} ({(alpha == 0).sum() / alpha.size * 100:.1f}%)')
print(f'alpha=255: {(alpha == 255).sum()} ({(alpha == 255).sum() / alpha.size * 100:.1f}%)')
print(f'alpha 1-254: {((alpha > 0) & (alpha < 255)).sum()}')

# 主体 bbox
mask = alpha > 10
ys, xs = np.where(mask)
print(f'主体 bbox: x=[{xs.min()},{xs.max()}] y=[{ys.min()},{ys.max()}]')