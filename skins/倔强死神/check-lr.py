"""检查 pet-sing.png 左右两侧的 alpha 分布"""
from PIL import Image
import numpy as np

img = Image.open(r'F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-sing.png').convert('RGBA')
arr = np.array(img)
h, w = arr.shape[:2]
print(f'canvas: {w}x{h}')

# 主体 bbox
mask = arr[:,:,3] > 10
ys, xs = np.where(mask)
print(f'主体 bbox: x=[{xs.min()},{xs.max()}], y=[{ys.min()},{ys.max()}]')

# 左右半边 alpha 分布对比
mid_x = w // 2
left = arr[:, :mid_x, 3]
right = arr[:, mid_x:, 3]
print(f'\n左半 (x < {mid_x}):')
print(f'  alpha=0: {(left==0).sum()}, alpha=255: {(left==255).sum()}, partial: {((left>0)&(left<255)).sum()}')
print(f'右半 (x >= {mid_x}):')
print(f'  alpha=0: {(right==0).sum()}, alpha=255: {(right==255).sum()}, partial: {((right>0)&(right<255)).sum()}')

# 顶部 200 行，左右各看 alpha=255 像素数
print(f'\n顶部 200 行 alpha=255 像素数（按左右分）:')
for y in range(80, 200, 10):
    left_cnt = (arr[y, :mid_x, 3] == 255).sum()
    right_cnt = (arr[y, mid_x:, 3] == 255).sum()
    print(f'  y={y:3d}: 左={left_cnt:4d}, 右={right_cnt:4d}')

# 看左右两侧 x=300 和 x=1700 处的列 alpha 分布
print(f'\n左列 x=300 处的 alpha 分布（看左翅膀）:')
for y in range(0, h, 100):
    a = arr[y, 300, 3]
    print(f'  y={y:4d}: alpha={a}')

print(f'\n右列 x=1700 处的 alpha 分布（看右翅膀）:')
for y in range(0, h, 100):
    a = arr[y, 1700, 3]
    print(f'  y={y:4d}: alpha={a}')