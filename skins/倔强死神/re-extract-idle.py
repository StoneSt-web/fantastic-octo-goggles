"""倔强死神 idle PNG 重新抠图 —— 修复左翅膀+左镰刀缺失。

源: pet-original.png (1386x1066 RGBA, 白底, 睁眼微笑, 翅膀+镰刀完整)

修复：
1. 用更宽松的白色判定 (sat < 15 & avg > 240)
2. 不删任何"非完全白色"的像素
3. 缩放 + bbox + 居中到 2048x2048
"""
from PIL import Image
import numpy as np
from collections import deque

SRC = r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-original.png"
DST = r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet.png"

img = Image.open(SRC).convert("RGBA")
arr = np.array(img).copy()
r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
h, w = arr.shape[:2]
print(f"源图: {w}x{h}")

avg = (r.astype(int) + g.astype(int) + b.astype(int)) / 3
maxc = np.maximum(np.maximum(r, g), b)
minc = np.minimum(np.minimum(r, g), b)
sat = maxc.astype(int) - minc.astype(int)

# 新阈值：只删几乎纯白的背景
is_white = (sat < 15) & (avg > 240)
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

# === 裁剪主体 ===
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
cropped_arr = arr[crop_bbox[1]:crop_bbox[3], crop_bbox[0]:crop_bbox[2]]
cropped = Image.fromarray(cropped_arr)
cw, ch = cropped.size
print(f"裁剪: {cropped.size}")

# === 缩放到 2048 长边 ===
scale = 2048 / max(cw, ch)
new_size = (int(cw * scale), int(ch * scale))
resized = cropped.resize(new_size, Image.Resampling.LANCZOS)
print(f"resize: {resized.size}, scale={scale:.3f}")

# === 居中到 2048x2048 ===
canvas = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
x = (2048 - new_size[0]) // 2
y = (2048 - new_size[1]) // 2
canvas.paste(resized, (x, y), resized)

canvas.save(DST)
print(f"Saved: {DST}")

# 验证
out = np.array(canvas)
mask = out[:,:,3] > 10
ys2, xs2 = np.where(mask)
print(f"\n=== 验证 ===")
print(f"alpha=0: {(out[:,:,3]==0).sum()} ({((out[:,:,3]==0).sum()/out[:,:,3].size)*100:.1f}%)")
print(f"new bbox: x=[{xs2.min()},{xs2.max()}], y=[{ys2.min()},{ys2.max()}]")

# 左右两侧 alpha 对比
mid_x = 1024
left_a0 = (out[:, :mid_x, 3] == 0).sum()
right_a0 = (out[:, mid_x:, 3] == 0).sum()
left_a255 = (out[:, :mid_x, 3] == 255).sum()
right_a255 = (out[:, mid_x:, 3] == 255).sum()
print(f"\n左半 alpha=0: {left_a0}, alpha=255: {left_a255}")
print(f"右半 alpha=0: {right_a0}, alpha=255: {right_a255}")
print(f"差值 (左-右) alpha=255: {left_a255 - right_a255}")