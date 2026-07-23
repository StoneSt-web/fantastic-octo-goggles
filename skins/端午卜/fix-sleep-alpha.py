"""修复端午 pet-sleep.png —— RGB 转 RGBA，识别主体并加 alpha。

策略：
1. 先转 RGBA（默认 alpha=255）
2. BFS floodfill 边缘连通的浅色像素 → alpha=0
3. 与倔强死神的抠图脚本一致
"""
from PIL import Image
import numpy as np
from collections import deque

p = r'F:\MinMax Code\0629\desktop-pet\skins\端午卜\frames\pet-sleep.png'
img = Image.open(p).convert('RGBA')
arr = np.array(img).copy()
r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
h, w = arr.shape[:2]
print(f'原图: {w}x{h} (RGB -> RGBA)')

avg = (r.astype(int) + g.astype(int) + b.astype(int)) / 3
maxc = np.maximum(np.maximum(r, g), b)
minc = np.minimum(np.minimum(r, g), b)
sat = maxc.astype(int) - minc.astype(int)

# 浅色背景判定（白底或浅灰底）
is_bg = (sat < 25) & (avg > 200)
print(f'背景像素 (白+浅灰): {is_bg.sum()}')

# BFS 边缘连通
visited = np.zeros_like(is_bg, dtype=bool)
queue = deque()

for y in range(h):
    for x in [0, w-1]:
        if is_bg[y, x] and not visited[y, x]:
            visited[y, x] = True
            queue.append((y, x))
for x in range(w):
    for y in [0, h-1]:
        if is_bg[y, x] and not visited[y, x]:
            visited[y, x] = True
            queue.append((y, x))

while queue:
    y, x = queue.popleft()
    for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w:
            if is_bg[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))

print(f'边缘连通背景像素: {visited.sum()}')
arr[visited, 3] = 0

out = Image.fromarray(arr)
out.save(p)
print(f'已保存 (RGBA): {p}')

# 验证
ver = np.array(out)
new_alpha = ver[:, :, 3]
print(f'\n验证:')
print(f'alpha=0: {(new_alpha == 0).sum()} ({(new_alpha == 0).sum() / new_alpha.size * 100:.1f}%)')
print(f'alpha=255: {(new_alpha == 255).sum()}')
mask = new_alpha > 10
ys, xs = np.where(mask)
print(f'主体 bbox: x=[{xs.min()},{xs.max()}] y=[{ys.min()},{ys.max()}]')