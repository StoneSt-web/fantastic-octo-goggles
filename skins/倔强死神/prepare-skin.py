"""倔强死神皮肤 —— 把扣好主体的 PNG 缩放居中到 2048x2048 + 占位填充 4 帧。

使用场景：
- 用户提供了原始 PNG（含白底）
- 抠图后主体占 PNG 较小区域，需要放大到填满 2048x2048
- 其他 4 帧暂时占位为 idle PNG（等一帧一帧出图后替换）

执行：python prepare-skin.py
"""
from PIL import Image
import numpy as np

SRC = r"F:\MinMax Code\0629\desktop-pet\skins\stubborn-grim-reaper\frames\pet-original.png"
ASSETS = r"F:\MinMax Code\0629\desktop-pet\assets"

# 抠图已经做过了（pet-original.png 主体已 alpha=0 透明化）
img = Image.open(SRC).convert("RGBA")
arr = np.array(img)
a = arr[:,:,3]
ys, xs = np.where(a > 0)
print(f"主体 bbox: x=[{xs.min()},{xs.max()}] y=[{ys.min()},{ys.max()}]")

# 裁剪主体 + 30px 余量
margin = 30
crop_bbox = (
    max(0, int(xs.min()) - margin),
    max(0, int(ys.min()) - margin),
    min(img.size[0], int(xs.max()) + margin),
    min(img.size[1], int(ys.max()) + margin),
)
cropped = img.crop(crop_bbox)
cw, ch = cropped.size
print(f"裁剪: {cropped.size}")

# 缩放到 2048 长边（保持宽高比）
scale = 2048 / max(cw, ch)
new_size = (int(cw * scale), int(ch * scale))
resized = cropped.resize(new_size, Image.Resampling.LANCZOS)
print(f"resize: {resized.size}, scale={scale:.3f}")

# 居中到 2048x2048 canvas
canvas = Image.new("RGBA", (2048, 2048), (0, 0, 0, 0))
x = (2048 - new_size[0]) // 2
y = (2048 - new_size[1]) // 2
canvas.paste(resized, (x, y), resized)

# 写到 assets 作为 idle
canvas.save(f"{ASSETS}/pet.png")
print(f"Saved: {ASSETS}/pet.png (2048x2048)")

# 占位填充 4 帧（暂用 idle，等出图后替换）
for name in ["pet-eye-closed.png", "pet-sleep.png", "pet-sing.png", "pet-surprised.png"]:
    canvas.save(f"{ASSETS}/{name}")
    print(f"  placeholder: {name}")