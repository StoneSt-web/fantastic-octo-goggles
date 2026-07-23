"""检查 pet-sing.png 的 alpha 分布 —— 找出哪些区域被透明化"""
from PIL import Image
import numpy as np

img = Image.open(r'F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-sing.png').convert('RGBA')
arr = np.array(img)
r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]

# 抠图前的原图（如果是 AI 出的，应该 RGB 是角色 + 白底）
# 但 pet-sing.png 可能是已抠图版，alpha=0 区域为背景

# 看整体 alpha 分布
print(f'canvas: {img.size}')
print(f'alpha=0 pixels: {(a==0).sum()} ({((a==0).sum()/a.size)*100:.1f}%)')
print(f'alpha=255 pixels: {(a==255).sum()} ({((a==255).sum()/a.size)*100:.1f}%)')

# 顶部 200 行的 alpha 分布 —— 看镰刀/头罩顶
print()
print('Top 200 rows:')
for y in range(0, 200, 20):
    alpha_0 = (a[y] == 0).sum()
    alpha_255 = (a[y] == 255).sum()
    other = 2048 - alpha_0 - alpha_255
    print(f'  y={y:3d}: alpha=0: {alpha_0:4d}, alpha=255: {alpha_255:4d}, partial: {other:4d}')

# 看中间区域 y=200~800 的 alpha 分布
print()
print('y=200-800 sample:')
for y in range(200, 800, 50):
    alpha_0 = (a[y] == 0).sum()
    alpha_255 = (a[y] == 255).sum()
    other = 2048 - alpha_0 - alpha_255
    print(f'  y={y:3d}: alpha=0: {alpha_0:4d}, alpha=255: {alpha_255:4d}, partial: {other:4d}')

# 看最左侧列的 alpha 分布（左边翅膀）
print()
print('x=0-200 sample (left wing area):')
for x in range(0, 200, 20):
    alpha_0 = (a[:, x] == 0).sum()
    alpha_255 = (a[:, x] == 255).sum()
    print(f'  x={x:3d}: alpha=0: {alpha_0:4d}, alpha=255: {alpha_255:4d}')

# 看最右侧列的 alpha 分布（右边翅膀）
print()
print('x=1848-2048 sample (right wing area):')
for x in range(1848, 2048, 20):
    alpha_0 = (a[:, x] == 0).sum()
    alpha_255 = (a[:, x] == 255).sum()
    print(f'  x={x:3d}: alpha=0: {alpha_0:4d}, alpha=255: {alpha_255:4d}')