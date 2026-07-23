"""halo-aware 抠图: 针对 halo 区域,直接按 RGB 判断白色像素做 alpha=0。

设计原则:
1. 5 张 raw 都是 RGB 模式 + 纯白背景 (matrix 出图约定)
2. halo 内部 RGB 接近纯白 (设计师应该把 halo 画成透明中心)
3. 抠图: 每个像素 RGB>240 视为白(背景/halo 内部), alpha=0
4. 主体像素 RGB<240 保留, alpha=255
5. 抗锯齿边缘: 部分像素 RGB 介于 240-254, alpha 用 smooth mask
6. halo 环本身 RGB 接近 (200-240,180-220,150-180) 浅金黄, 必须保留！
7. 所以不能用 "RGB > 240 → transparent" 简单粗暴 —— 金色 halo 也会被误伤

更好的方法:
- BFS floodfill 从图像 4 边开始连通白色像素 → 主背景
- halo 内部白色跟边缘 BFS 连通 → 也被抠掉 (OK, 这就是要的)
- halo 环本身不是白色 → 不会误伤 (OK)
- 主体内的小亮区(眼睛白底/翅膀高光)BFS 不连通 → 保留 (OK)

算法:
1. mask = np.ones(H,W, dtype=uint8) * 255  # default opaque
2. visited = np.zeros(H,W, bool)
3. BFS from all 4 edges, mark white pixels with r,g,b > 240
4. mask[background_visited] = 0
5. Save as RGBA
"""
from PIL import Image
import numpy as np
from collections import deque

def carve(src, dst, white_thresh=240):
    img = Image.open(src)
    arr = np.array(img)
    if arr.ndim == 2:
        arr = np.stack([arr]*3, axis=-1)
    H, W = arr.shape[:2]

    # 白色像素判定: r>thresh & g>thresh & b>thresh
    r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
    white_mask = (r > white_thresh) & (g > white_thresh) & (b > white_thresh)

    # BFS from 4 edges
    visited = np.zeros((H, W), dtype=bool)
    q = deque()
    # 初始化队列: 4 边上所有 white 像素
    for x in range(W):
        if white_mask[0, x] and not visited[0, x]:
            q.append((0, x)); visited[0, x] = True
        if white_mask[H-1, x] and not visited[H-1, x]:
            q.append((H-1, x)); visited[H-1, x] = True
    for y in range(H):
        if white_mask[y, 0] and not visited[y, 0]:
            q.append((y, 0)); visited[y, 0] = True
        if white_mask[y, W-1] and not visited[y, W-1]:
            q.append((y, W-1)); visited[y, W-1] = True

    # BFS 4-连通
    while q:
        y, x = q.popleft()
        for dy, dx in [(-1,0),(1,0),(0,-1),(0,1)]:
            ny, nx = y+dy, x+dx
            if 0 <= ny < H and 0 <= nx < W and not visited[ny, nx] and white_mask[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    # Build RGBA
    alpha = np.where(visited, 0, 255).astype(np.uint8)
    rgba = np.dstack([arr[:,:,:3], alpha])

    out = Image.fromarray(rgba, mode='RGBA')
    out.save(dst, optimize=True)

    n_bg = visited.sum()
    n_total = H * W
    print(f'  {src.split(chr(92))[-1]}: bg={n_bg}/{n_total} ({100*n_bg/n_total:.1f}%)')

if __name__ == '__main__':
    import sys
    frames_dir = r'F:\MinMax Code\0629\desktop-pet\skins\阳光天使\frames'
    srcs = [
        ('raw-idle-strict.png', 'idle.png'),
        ('raw-blink-strict3.png', 'blink.png'),
        ('raw-sleep-strict2.png', 'sleep.png'),
        ('raw-sing-strict2.png', 'sing.png'),
        ('raw-wave-strict2.png', 'wave.png'),
    ]
    for src, dst in srcs:
        carve(f'{frames_dir}\\{src}', f'{frames_dir}\\{dst}')
