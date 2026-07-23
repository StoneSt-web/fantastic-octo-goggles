"""倔强死神 PNG 抠图 —— 复用端午皮肤的 BFS floodfill 方案。

策略：
1. 灰背景判定：saturation < 50 AND avg(R,G,B) > 150
2. BFS floodfill 从 PNG 四边出发 → 标记与边缘连通的灰像素 → alpha=0
3. （如有需要）单独处理装饰元素
"""
from PIL import Image
import numpy as np
from collections import deque

SRC = r"C:\Users\12690\.mavis\uploads\1783351252040-image.png"
DST = r"F:\MinMax Code\0629\desktop-pet\skins\stubborn-grim-reaper\frames\pet-original.png"

import os
os.makedirs(os.path.dirname(DST), exist_ok=True)

img = Image.open(SRC).convert("RGBA")
arr = np.array(img).copy()
r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
h, w = arr.shape[:2]
print(f'原图: {w}x{h}')

avg = (r.astype(int) + g.astype(int) + b.astype(int)) / 3
maxc = np.maximum(np.maximum(r, g), b)
minc = np.minimum(np.minimum(r, g), b)
sat = maxc.astype(int) - minc.astype(int)

# 白色背景（这张图是白底）
is_white = (sat < 30) & (avg > 220)
print(f'白色像素: {is_white.sum()}')

# BFS 从四边出发：标记与边缘连通的白像素 → 透明
visited = np.zeros_like(is_white, dtype=bool)
queue = deque()

for y in range(h):
    for x in [0, w-1]:
        if is_white[y, x] and not visited[y, x]:
            visited[y, x] = True
            queue.append((y, x))
for x in range(w):
    for y in [0, h-1]:
        if is_white[y, x] and not visited[y, x]:
            visited[y, x] = True
            queue.append((y, x))

while queue:
    y, x = queue.popleft()
    for dy, dx in [(-1,0),(1,0),(0,-1),(0,1)]:
        ny, nx = y+dy, x+dx
        if 0 <= ny < h and 0 <= nx < w:
            if is_white[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))

print(f'边缘连通白像素: {visited.sum()}')
arr[visited, 3] = 0

out = Image.fromarray(arr)
out.save(DST)
print(f'Saved: {DST}')