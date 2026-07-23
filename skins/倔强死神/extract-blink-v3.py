"""倔强死神 blink PNG 重新抠图 —— 让 bbox 跟 idle 完全一致。

idle bbox: x=[52,1997] y=[155,1931]
- top margin: 155, bottom margin: 116
- bbox size: 1945x1776

blink 当前: top=116, bottom=115, bbox=1987x1816 → 主体填得太满
修复: 缩放主体让 bbox 跟 idle 一致
"""
from PIL import Image
import numpy as np
from collections import deque

SRC = r"F:\MinMax Code\0629\matrix-media-1783421082522-1196f095.png"
DST = r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-eye-closed.png"

img = Image.open(SRC).convert("RGBA")
arr = np.array(img).copy()
r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
h, w = arr.shape[:2]
print(f"源图: {w}x{h}")

# Step 1: 删水印
water_threshold_x = int(w * 0.82)
water_threshold_y = int(h * 0.85)
arr[water_threshold_y:, water_threshold_x:, 3] = 0

# Step 2: 删底部阴影（限制在底部 5%）
r_chan = arr[:, :, 0].astype(int)
g_chan = arr[:, :, 1].astype(int)
b_chan = arr[:, :, 2].astype(int)
bottom_y = int(h * 0.95)
shadow_region_mask = np.zeros_like(r_chan, dtype=bool)
shadow_region_mask[bottom_y:] = True
shadow_mask = shadow_region_mask & \
              (r_chan > 180) & (g_chan > 180) & (b_chan > 180) & \
              (np.abs(r_chan - g_chan) < 30) & (np.abs(g_chan - b_chan) < 30)
arr[shadow_mask, 3] = 0

# Step 3: BFS 抠白底
avg = (r.astype(int) + g.astype(int) + b.astype(int)) / 3
maxc = np.maximum(np.maximum(r, g), b)
minc = np.minimum(np.minimum(r, g), b)
sat = maxc.astype(int) - minc.astype(int)

is_white = (sat < 15) & (avg > 240)
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
arr[visited, 3] = 0

# Step 4: 裁剪主体（margin 0，先贴紧）
ys, xs = np.where(arr[:,:,3] > 0)
margin = 0  # 不加 margin，让主体自然
crop_bbox = (
    max(0, int(xs.min())),
    max(0, int(ys.min())),
    min(w, int(xs.max()) + 1),
    min(h, int(ys.max()) + 1),
)
cropped = arr[crop_bbox[1]:crop_bbox[3], crop_bbox[0]:crop_bbox[2]]
cropped_img = Image.fromarray(cropped)
cw, ch = cropped_img.size
print(f"裁剪: {cropped_img.size}")

# Step 5: 缩放 —— 目标让主体在 2048x2048 canvas 中占比和 idle 一致
# idle bbox 在 2048x2048 中: 1945x1776 (宽 95.0%, 高 86.7%)
# 我们的目标: 让 blink 主体 bbox 占比也是 1945/2048 宽 + 1776/2048 高
# 但 idle 的主体比例跟 blink 源图比例可能不同 —— 这里直接用 bbox 高度比例

# 先计算 idle 的 bbox 比例 (height ratio = 1776/2048 = 0.8672)
# 让 blink 主体缩放后高度 = 2048 * 0.8672 = 1776 px
target_h = int(2048 * 1776 / 2048)  # = 1776
scale = target_h / ch
new_size = (int(cw * scale), int(ch * scale))
resized = cropped_img.resize(new_size, Image.Resampling.LANCZOS)
print(f"resize: {resized.size}, scale={scale:.3f}")

# 居中到 2048x2048 (按 idle 的 margin: top=155, bottom=116, left=52, right=50)
canvas = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
# 水平居中 (idle left=52 right=50, 偏差小，按 52 算)
x = (2048 - new_size[0]) // 2  # 大致居中
# 垂直位置: idle top=155, 让 blink 也对齐 top=155
y = 155  # 与 idle top margin 完全一致
canvas.paste(resized, (x, y), resized)

canvas.save(DST)
print(f"Saved: {DST}")

# 验证
out = np.array(canvas)
mask = out[:,:,3] > 10
ys2, xs2 = np.where(mask)
print(f"\n=== 验证 (跟 idle 对比) ===")
print(f"canvas: 2048x2048")
print(f"bbox: x=[{xs2.min()},{xs2.max()}] y=[{ys2.min()},{ys2.max()}]")
print(f"top margin: {ys2.min()}px (idle 是 155)")
print(f"bottom margin: {2047 - ys2.max()}px (idle 是 116)")
print(f"bbox size: {xs2.max()-xs2.min()}x{ys2.max()-ys2.min()} (idle 是 1945x1776)")