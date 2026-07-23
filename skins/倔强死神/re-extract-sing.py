"""倔强死神 sing PNG 重新抠图 —— 修复顶部"溶解" + 删掉豆包AI水印。

源: uploads/1783386762057-image.png (1920x1920 RGB, 白底)
- 原抠图阈值太松（sat < 30 & avg > 220）→ 镰刀/头罩/翅膀高光被误删
- 新阈值: sat < 10 & avg > 245 → 只删纯白背景
- 右下角有"豆包AI生成"水印 → 抠图时会自动被 BFS 删掉（边缘连通）

输出: frames/pet-sing.png (2048x2048 RGBA, 主体填满)
"""
from PIL import Image
import numpy as np
from collections import deque

SRC = r"C:\Users\12690\.mavis\uploads\1783386762057-image.png"
DST = r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-sing.png"

img = Image.open(SRC).convert("RGBA")
arr = np.array(img).copy()
r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
h, w = arr.shape[:2]
print(f"源图: {w}x{h}")

avg = (r.astype(int) + g.astype(int) + b.astype(int)) / 3
maxc = np.maximum(np.maximum(r, g), b)
minc = np.minimum(np.minimum(r, g), b)
sat = maxc.astype(int) - minc.astype(int)

# === 新阈值：只删纯白 ===
is_white = (sat < 10) & (avg > 245)
print(f"白色像素: {is_white.sum()}")

# BFS from edges
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

print(f"边缘连通白像素: {visited.sum()}")
arr[visited, 3] = 0

# 裁剪主体 + 30px 余量
ys, xs = np.where(arr[:,:,3] > 0)
if len(ys) == 0:
    print("ERROR: 抠完没有主体！")
    import sys; sys.exit(1)
print(f"主体 bbox: x=[{xs.min()},{xs.max()}] y=[{ys.min()},{ys.max()}]")

margin = 30
crop_bbox = (
    max(0, int(xs.min()) - margin),
    max(0, int(ys.min()) - margin),
    min(w, int(xs.max()) + margin),
    min(h, int(ys.max()) + margin),
)
cropped = arr[crop_bbox[1]:crop_bbox[3], crop_bbox[0]:crop_bbox[2]]
cropped_img = Image.fromarray(cropped)
cw, ch = cropped_img.size
print(f"裁剪: {cropped_img.size}")

# 缩放到 2048 长边（保持比例）
scale = 2048 / max(cw, ch)
new_size = (int(cw * scale), int(ch * scale))
resized = cropped_img.resize(new_size, Image.Resampling.LANCZOS)
print(f"resize: {resized.size}, scale={scale:.3f}")

# 居中到 2048x2048
canvas = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
x = (2048 - new_size[0]) // 2
y = (2048 - new_size[1]) // 2
canvas.paste(resized, (x, y), resized)

canvas.save(DST)
print(f"Saved: {DST}")

# 验证 alpha 分布
out = np.array(canvas)
mask = out[:,:,3] > 10
ys2, xs2 = np.where(mask)
print(f"\n=== 验证 ===")
print(f"alpha=0: {(out[:,:,3]==0).sum()} ({((out[:,:,3]==0).sum()/out[:,:,3].size)*100:.1f}%)")
print(f"new bbox: x=[{xs2.min()},{xs2.max()}], y=[{ys2.min()},{ys2.max()}]")
print(f"top margin: {ys2.min()}px")

# 顶部 200 行详细检查
print("\nTop 200 rows alpha=255 count:")
for y in range(0, 200, 10):
    cnt = (out[y,:,3] == 255).sum()
    print(f"  y={y:3d}: {cnt:4d} pixels")