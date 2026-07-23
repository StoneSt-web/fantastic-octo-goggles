"""对比 uploads 里候选 PNG 和 pet-sing.png 的大小、模式"""
from PIL import Image
import os

candidates = [
    r"C:\Users\12690\.mavis\uploads\1783386762057-image.png",  # 389KB, 09:12
    r"C:\Users\12690\.mavis\uploads\1783387569206-image.png",  # 206KB, 09:26
    r"C:\Users\12690\.mavis\uploads\1783387958371-image.png",  # 186KB, 09:32
    r"C:\Users\12690\.mavis\uploads\1783388022789-image.png",  # 184KB, 09:33
]
target = r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-sing.png"

print(f"target: {target}")
img = Image.open(target)
print(f"  size: {img.size}, mode: {img.mode}")

for c in candidates:
    if os.path.exists(c):
        try:
            img = Image.open(c)
            print(f"\n{c.split(chr(92))[-1]}:")
            print(f"  size: {img.size}, mode: {img.mode}")
        except Exception as e:
            print(f"\n{c.split(chr(92))[-1]}: error - {e}")