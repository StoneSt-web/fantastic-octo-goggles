"""对比 idle 源候选"""
from PIL import Image
import os

# pet.png 是 2026/7/6 23:42:53 生成
# 找当天的上传
candidates = [
    r"C:\Users\12690\.mavis\uploads\1783352437462-image.png",  # 169KB, 7/6 23:40:37
    r"C:\Users\12690\.mavis\uploads\1783351252040-image.png",  # 177KB, 7/6 23:20:52
    r"C:\Users\12690\.mavis\uploads\1783344024500-image.png",  # 439KB, 7/6 21:20:24
    r"C:\Users\12690\.mavis\uploads\1783343364098-image.png",  # 172KB, 7/6 21:09:24
]
for c in candidates:
    if os.path.exists(c):
        try:
            img = Image.open(c)
            print(f'{c.split(chr(92))[-1]}: {img.size} {img.mode}')
        except Exception as e:
            print(f'{c.split(chr(92))[-1]}: error {e}')