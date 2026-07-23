"""检查 pet.png (idle) 的左右 alpha 分布"""
from PIL import Image
import numpy as np

img = Image.open(r'F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet.png').convert('RGBA')
arr = np.array(img)
h, w = arr.shape[:2]
print(f'canvas: {w}x{h}')

mid_x = w // 2
left = arr[:, :mid_x, 3]
right = arr[:, mid_x:, 3]
print(f'左半 (x < {mid_x}):')
print(f'  alpha=0: {(left==0).sum()}, alpha=255: {(left==255).sum()}, partial: {((left>0)&(left<255)).sum()}')
print(f'右半 (x >= {mid_x}):')
print(f'  alpha=0: {(right==0).sum()}, alpha=255: {(right==255).sum()}, partial: {((right>0)&(right<255)).sum()}')

# 看左翅膀区域 alpha 分布
print('\n左翅膀区域 (x < 1024, y 100-1500) alpha 分布:')
left_wing = arr[100:1500, :mid_x, 3]
print(f'  alpha=0: {(left_wing==0).sum()}, alpha=255: {(left_wing==255).sum()}')

print('\n右翅膀区域 (x >= 1024, y 100-1500) alpha 分布:')
right_wing = arr[100:1500, mid_x:, 3]
print(f'  alpha=0: {(right_wing==0).sum()}, alpha=255: {(right_wing==255).sum()}')