"""倔强死神 wave (打招呼) PNG 抠图。

源: uploads/1783418211412-image.png
- 1920x1920 RGB, 白底, 豆包水印在右下角
- 表情: 微笑 + 左手举起 + 右手持镰刀
- 比 idle 多的变化: 手势（举左手）
- 区别: 不像 idle 双手持镰刀、不像 sing 张大嘴

输出: frames/pet-wave.png (2048x2048 RGBA, 主体填满)
"""
from PIL import Image
import numpy as np
from collections import deque

SRC = r"C:\Users\12690\.mavis\uploads\1783418211412-image.png"
DST = r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-wave.png"

img = Image.open(SRC).convert("RGBA")
arr = np.array(img).copy()
r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]
h, w = arr.shape[:2]
print(f"源图: {w}x{h}")

# === Step 1: 删右下角水印 ===
water_threshold_x = int(w * 0.82)
water_threshold_y = int(h * 0.85)
print(f"水印区域: x>={water_threshold_x}, y>={water_threshold_y}")
arr[water_threshold_y:, water_threshold_x:, 3] = 0

# === Step 2: 删底部阴影（限制在底部 5%） ===
r_chan = arr[:, :, 0].astype(int)
g_chan = arr[:, :, 1].astype(int)
b_chan = arr[:, :, 2].astype(int)
bottom_y = int(h * 0.95)
shadow_region_mask = np.zeros_like(r_chan, dtype=bool)
shadow_region_mask[bottom_y:] = True
shadow_mask = shadow_region_mask & \
              (r_chan > 180) & (g_chan > 180) & (b_chan > 180) & \
              (np.abs(r_chan - g_chan) < 30) & (np.abs(g_chan - b_chan) < 30)
print(f"底部阴影像素: {shadow_mask.sum()}")
arr[shadow_mask, 3] = 0

# === Step 3: BFS 抠白底 ===
avg = (r.astype(int) + g.astype(int) + b.astype(int)) / 3
maxc = np.maximum(np.maximum(r, g), b)
minc = np.minimum(np.minimum(r, g), b)
sat = maxc.astype(int) - minc.astype(int)

is_white = (sat < 15) & (avg > 240)
print(f"白色像素: {is_white.sum()}")

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

# === Step 4: 裁剪 + 缩放居中到 2048 ===
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

scale = 2048 / max(cw, ch)
new_size = (int(cw * scale), int(ch * scale))
resized = cropped_img.resize(new_size, Image.Resampling.LANCZOS)
print(f"resize: {resized.size}, scale={scale:.3f}")

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