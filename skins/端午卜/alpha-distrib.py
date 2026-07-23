"""直接看 pet-sleep.png 的渲染效果 - 缩到 256 看整体"""
from PIL import Image
import numpy as np

p = r'F:\MinMax Code\0629\desktop-pet\skins\端午卜\frames\pet-sleep.png'
img = Image.open(p).convert('RGBA')
arr = np.array(img)

# 整个 PNG 的 alpha 分布
alphas = arr[:, :, 3]
alpha_unique, counts = np.unique(alphas, return_counts=True)
print('alpha 分布:')
for a, c in zip(alpha_unique, counts):
    if c > 1000:
        print(f'  alpha={a}: {c} pixels ({100*c/(arr.shape[0]*arr.shape[1]):.1f}%)')

# 不透明像素的 RGB 平均
opaque = arr[alphas > 200]
print(f'\n不透明像素数: {len(opaque)}')

# 找米色像素 (245, 248, 239)
mask_beige = (arr[:, :, 0] > 230) & (arr[:, :, 1] > 230) & (arr[:, :, 2] > 230)
print(f'\n米色 ~245 像素数: {mask_beige.sum()}')

# 找棋盘格标准灰 (167, 167, 167)
mask_checker = (arr[:, :, 0] > 160) & (arr[:, :, 0] < 175) & \
               (arr[:, :, 1] > 160) & (arr[:, :, 1] < 175) & \
               (arr[:, :, 2] > 160) & (arr[:, :, 2] < 175)
print(f'\n棋盘格灰 ~167 像素数: {mask_checker.sum()}')

# 找棋盘格的"深灰"或"白色"区域
mask_white = (arr[:, :, 0] > 240) & (arr[:, :, 1] > 240) & (arr[:, :, 2] > 240)
print(f'\n白色 ~240+ 像素数: {mask_white.sum()}')

mask_dark_gray = (arr[:, :, 0] > 70) & (arr[:, :, 0] < 100) & \
                 (arr[:, :, 1] > 70) & (arr[:, :, 1] < 100) & \
                 (arr[:, :, 2] > 70) & (arr[:, :, 2] < 100)
print(f'\n深灰 ~80 像素数: {mask_dark_gray.sum()}')

# 找 RGB 全相同 (棋盘格特征 - 灰阶)
rgb_diff = np.abs(arr[:, :, 0].astype(int) - arr[:, :, 1].astype(int)) + \
           np.abs(arr[:, :, 1].astype(int) - arr[:, :, 2].astype(int))
mask_neutral = (rgb_diff < 5) & (alphas > 200)
print(f'\n灰阶 (中性 RGB) 像素数: {mask_neutral.sum()}')