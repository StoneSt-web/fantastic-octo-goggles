"""端午 zongzi pet-sleep.png —— 只保留主体，其他清空。

策略：
1. 抠图识别边缘连通的浅色 → alpha=0（已做过但不彻底）
2. 第二轮：基于主要 alpha bbox，把 bbox 外所有"非完全实体"的像素清掉（保留 bbox 内所有像素）
3. 裁剪 + 缩放到 2048x2048 居中

修复 zongzi 周围灰色噪点问题。
"""
from PIL import Image
import numpy as np
from collections import deque

p = r'F:\MinMax Code\0629\desktop-pet\skins\端午卜\frames\pet-sleep.png'
img = Image.open(p).convert('RGBA')
arr = np.array(img).copy()
r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
h, w = arr.shape[:2]
print(f'源图: {w}x{h}')

# Step 1: BFS 抠白底/浅灰背景
avg = (r.astype(int) + g.astype(int) + b.astype(int)) / 3
maxc = np.maximum(np.maximum(r, g), b)
minc = np.minimum(np.minimum(r, g), b)
sat = maxc.astype(int) - minc.astype(int)
is_bg = (sat < 25) & (avg > 200)
print(f'背景像素: {is_bg.sum()}')

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

print(f'BFS 边缘背景: {visited.sum()}')
arr[visited, 3] = 0

# Step 2: 找主体 bbox
mask = arr[:, :, 3] > 10
ys, xs = np.where(mask)
if len(ys) == 0:
    print('ERROR: 没主体')
    exit(1)
print(f'主体 bbox: x=[{xs.min()},{xs.max()}] y=[{ys.min()},{ys.max()}]')

# Step 3: 主要修复 —— bbox 外 + bbox 内半透明像素都清理
# bbox 外的半透明边缘噪点 → alpha=0
# bbox 内的半透明边缘（zongzi 抗锯齿像素）→ alpha=255（让边缘完全实心）
bbox_x1, bbox_y1 = xs.min(), ys.min()
bbox_x2, bbox_y2 = xs.max(), ys.max()
print(f'主体 bbox: x=[{bbox_x1},{bbox_x2}] y=[{bbox_y1},{bbox_y2}]')
out = arr.copy()

# bbox 内半透明像素 → alpha=255（边缘实心化，避免缩放后"颗粒"）
inside_semi = (arr[:, :, 3] > 0) & (arr[:, :, 3] < 255)
# 仅 bbox 内
bbox_inside_mask = np.zeros_like(arr[:, :, 3], dtype=bool)
bbox_inside_mask[bbox_y1:bbox_y2+1, bbox_x1:bbox_x2+1] = True
inside_semi_in_bbox = inside_semi & bbox_inside_mask
print(f'bbox 内半透明像素 (alpha 1-254): {inside_semi_in_bbox.sum()}')
out[inside_semi_in_bbox, 3] = 255

# bbox 外所有 alpha=1-254 → 0（背景彻底透明）
outside_mask = ~bbox_inside_mask
semi_outside = (arr[:, :, 3] > 0) & (arr[:, :, 3] < 255) & outside_mask
print(f'bbox 外半透明像素: {semi_outside.sum()}')
out[semi_outside, 3] = 0

# 验证
mask2 = out[:, :, 3] > 10
ys2, xs2 = np.where(mask2)
print(f'清理后 bbox: x=[{xs2.min()},{xs2.max()}] y=[{ys2.min()},{ys2.max()}]')

# 保存
out_img = Image.fromarray(out)
out_img.save(p)
print(f'已保存: {p}')

# 最后统计
final = np.array(Image.open(p))
final_alpha = final[:, :, 3]
print(f'\n最终统计:')
print(f'  alpha=0: {(final_alpha == 0).sum()} ({(final_alpha == 0).sum() / final_alpha.size * 100:.1f}%)')
print(f'  alpha 1-200: {((final_alpha > 0) & (final_alpha < 200)).sum()}')
print(f'  alpha=255: {(final_alpha == 255).sum()}')