"""修复: 把所有 pet-*.png 中米色/白色装饰元素都 alpha=0"""
from PIL import Image
import numpy as np

FILES = [
    'pet-idle.png', 'pet-blink.png', 'pet-sleep.png', 'pet-sing.png',
    'pet-original.png', 'pet-wave.png', 'pet-surprised.png',
]

import os
DIR = r'F:\MinMax Code\0629\desktop-pet\skins\端午卜\frames'

for fname in FILES:
    p = os.path.join(DIR, fname)
    if not os.path.exists(p):
        print(f'\n[{fname}] SKIP (not exist)')
        continue
    img = Image.open(p).convert('RGBA')
    arr = np.array(img).copy()
    h, w = arr.shape[:2]

    # Strategy:
    # 1. 主体的 RGB 通常是饱和度高的（红绿蓝等）—— 不动
    # 2. 装饰元素（米色/白色/浅灰）像素饱和度低、RGB 都接近 —— 设 alpha=0
    # 3. 但是要保留主体的"白色高光"（眼睛白底之类）—— 用 BFS floodfill 从边缘反向

    R = arr[:, :, 0].astype(int)
    G = arr[:, :, 1].astype(int)
    B = arr[:, :, 2].astype(int)

    # 第一步: 计算"接近灰阶" mask (装饰元素特征)
    max_rgb = np.maximum(np.maximum(R, G), B)
    min_rgb = np.minimum(np.minimum(R, G), B)
    chroma = max_rgb - min_rgb

    # 灰阶像素 (低饱和度) + 亮度高
    gray_mask = (chroma < 20) & (max_rgb > 180)

    # 第二步: 在这个灰阶 mask 上做 BFS floodfill 从四边出发
    # 找到所有"和边缘连通的灰阶区域" —— 这些就是背景装饰
    visited = np.zeros((h, w), dtype=bool)
    from collections import deque
    queue = deque()

    # 标记所有灰阶像素为可达候选
    candidate = gray_mask

    # 从四边 BFS
    edges = []
    for x in range(w):
        edges.append((0, x))
        edges.append((h-1, x))
    for y in range(h):
        edges.append((y, 0))
        edges.append((y, w-1))

    for y, x in edges:
        if candidate[y, x] and not visited[y, x]:
            visited[y, x] = True
            queue.append((y, x))

    while queue:
        y, x = queue.popleft()
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = y+dy, x+dx
            if 0 <= ny < h and 0 <= nx < w and candidate[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                queue.append((ny, nx))

    # 第三步: 把 BFS 找到的边缘连通灰阶像素 alpha=0
    arr[visited, 3] = 0

    n_decoration = visited.sum()
    print(f'\n[{fname}] {w}x{h}: 装饰元素像素 = {n_decoration} ({100*n_decoration/(w*h):.1f}%)')

    # 保存
    out = Image.fromarray(arr)
    out.save(p, optimize=True)
    print(f'  -> saved')

print('\n[done]')