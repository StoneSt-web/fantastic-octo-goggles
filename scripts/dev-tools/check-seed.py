"""检查 seed.png 是否透明 + 抽样颜色"""
from PIL import Image
import numpy as np

p = r'F:\MinMax Code\0629\desktop-pet\skins\阳光天使\frames\seed.png'
img = Image.open(p)
print(f'mode: {img.mode}, size: {img.size}')

if img.mode == 'RGBA':
    arr = np.array(img)
    h, w = arr.shape[:2]
    alphas = arr[:, :, 3]
    print(f'alpha=0: {(alphas == 0).sum()}, alpha=255: {(alphas == 255).sum()}')
    # 主体 bbox
    mask = alphas > 0
    if mask.any():
        ys, xs = np.where(mask)
        print(f'bbox: y={ys.min()}-{ys.max()}, x={xs.min()}-{xs.max()}')
elif img.mode == 'RGB':
    arr = np.array(img)
    h, w = arr.shape[:2]
    print(f'RGB mode, no alpha')
    print(f'first pixel: {arr[0, 0]}')
    print(f'center pixel: {arr[h//2, w//2]}')
else:
    print(f'other mode: {img.mode}')