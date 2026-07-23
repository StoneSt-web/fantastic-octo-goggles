"""看端午 pet-sleep.png 的半透明像素分布"""
from PIL import Image
import numpy as np

p = r'F:\MinMax Code\0629\desktop-pet\skins\端午卜\frames\pet-sleep.png'
img = Image.open(p).convert('RGBA')
arr = np.array(img)
h, w = arr.shape[:2]

alpha = arr[:, :, 3]
r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

# 半透明像素（1-254）
semi = (alpha > 0) & (alpha < 255)
print(f'半透明像素: {semi.sum()} ({semi.sum()/alpha.size*100:.2f}%)')

# 看半透明像素的 RGB 分布
semi_rgb = arr[semi][:, :3]
print(f'半透明像素 RGB:')
print(f'  R: {semi_rgb[:, 0].min()}-{semi_rgb[:, 0].max()}, G: {semi_rgb[:, 1].min()}-{semi_rgb[:, 1].max()}, B: {semi_rgb[:, 2].min()}-{semi_rgb[:, 2].max()}')
print(f'  avg: ({semi_rgb[:, 0].mean():.0f}, {semi_rgb[:, 1].mean():.0f}, {semi_rgb[:, 2].mean():.0f})')

# 这些是不是都在主体边缘附近
# 把 1-254 的变成 0 看会不会有破坏
semi_rgb_colors = {}
for r_val in range(0, 256, 32):
    for g_val in range(0, 256, 32):
        for b_val in range(0, 256, 32):
            cnt = ((r >= r_val) & (r < r_val+32) & (g >= g_val) & (g < g_val+32) & (b >= b_val) & (b < b_val+32) & semi).sum()
            if cnt > 0:
                semi_rgb_colors[(r_val, g_val, b_val)] = cnt

print('\n半透明像素 RGB 分布 (top 10):')
for rgb, cnt in sorted(semi_rgb_colors.items(), key=lambda x: -x[1])[:10]:
    print(f'  rgb~={rgb}: {cnt} pixels')