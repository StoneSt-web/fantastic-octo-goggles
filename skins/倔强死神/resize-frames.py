"""把所有帧 PNG 缩到 512x512 —— 减少 base64 体积，避免切换时解码卡顿。

桌面渲染只显示 136x136，2K 实际多余。
缩到 1024x1024 已经足够，再小到 512x512 也清晰。
"""
from PIL import Image
import os

frames = [
    'pet.png',
    'pet-eye-closed.png',
    'pet-sleep.png',
    'pet-sing.png',
    'pet-wave.png',
]
SKIN_DIR = r'F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames'
TARGET_SIZE = 1024  # 桌宠只显示 136x136，2K 多余

print(f'{"file":<25} {"before":<12} {"after":<12} {"ratio"}')
for name in frames:
    path = os.path.join(SKIN_DIR, name)
    if not os.path.exists(path):
        continue
    before = os.path.getsize(path)
    img = Image.open(path).convert('RGBA')
    if img.size == (TARGET_SIZE, TARGET_SIZE):
        print(f'{name:<25} 已经是 {TARGET_SIZE}x{TARGET_SIZE}, skip')
        continue
    resized = img.resize((TARGET_SIZE, TARGET_SIZE), Image.Resampling.LANCZOS)
    resized.save(path)
    after = os.path.getsize(path)
    print(f'{name:<25} {before:>10,} -> {after:>10,} ({after/before*100:.1f}%)')