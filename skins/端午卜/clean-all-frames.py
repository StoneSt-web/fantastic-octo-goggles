"""批量清理端午 zongzi 所有帧的边缘半透明像素 —— 跟 fix-sleep-final 一致。

策略:
- RGB → RGBA (如果需要)
- BFS floodfill 边缘连通的浅色 → alpha=0
- bbox 外 alpha=1-254 → 0 (背景干净)
- bbox 内 alpha=1-254 → 255 (边缘实心)
"""
from PIL import Image
import numpy as np
from collections import deque
import os

SKIN = r'F:\MinMax Code\0629\desktop-pet\skins\端午卜\frames'

def process(frame_path):
    print(f'\n=== {os.path.basename(frame_path)} ===')
    img = Image.open(frame_path)
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    arr = np.array(img).copy()
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    h, w = arr.shape[:2]
    print(f'  原图: {w}x{h}, mode=RGBA')

    # BFS 抠白底
    avg_c = (r.astype(int) + g.astype(int) + b.astype(int)) / 3
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    sat = maxc.astype(int) - minc.astype(int)
    is_bg = (sat < 25) & (avg_c > 200)
    print(f'  背景像素: {is_bg.sum()}')

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
    print(f'  BFS 边缘背景: {visited.sum()}')
    arr[visited, 3] = 0

    # 找主体 bbox
    mask = arr[:, :, 3] > 10
    ys, xs = np.where(mask)
    if len(ys) == 0:
        print('  ERROR: 主体为空')
        return
    print(f'  主体 bbox: x=[{xs.min()},{xs.max()}] y=[{ys.min()},{ys.max()}]')

    out = arr.copy()
    # bbox 内半透明 → alpha=255 (边缘实心化)
    bbox_inside = np.zeros_like(arr[:, :, 3], dtype=bool)
    bbox_inside[ys.min():ys.max()+1, xs.min():xs.max()+1] = True
    inside_semi = (arr[:, :, 3] > 0) & (arr[:, :, 3] < 255) & bbox_inside
    print(f'  bbox 内半透明 → 255: {inside_semi.sum()}')
    out[inside_semi, 3] = 255

    # bbox 外半透明 → 0
    outside_semi = (arr[:, :, 3] > 0) & (arr[:, :, 3] < 255) & ~bbox_inside
    print(f'  bbox 外半透明 → 0: {outside_semi.sum()}')
    out[outside_semi, 3] = 0

    Image.fromarray(out).save(frame_path)
    print(f'  已保存')

    final = np.array(Image.open(frame_path))
    fa = final[:, :, 3]
    print(f'  验证: alpha=0 {(fa==0).sum()}, alpha=255 {(fa==255).sum()}, semi {((fa>0)&(fa<255)).sum()}')


for name in ['pet.png', 'pet-eye-closed.png']:
    process(os.path.join(SKIN, name))