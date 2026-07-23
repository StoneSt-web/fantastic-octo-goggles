"""把 pet-sleep.png 缩到 256x256 用纯黑背景合成预览 - 看 PNG 自身是否有底纹"""
from PIL import Image
import numpy as np

p = r'F:\MinMax Code\0629\desktop-pet\skins\端午卜\frames\pet-sleep.png'
img = Image.open(p).convert('RGBA')
arr = np.array(img)

# 缩到 512 渲染
small = img.resize((512, 512), Image.LANCZOS)
# 黑色背景合成预览
bg = Image.new('RGB', (512, 512), (0, 0, 0))
bg.paste(small, mask=small.split()[3])
bg.save(r'F:\MinMax Code\0629\desktop-pet\skins\端午卜\preview-sleep-black.png')

# 蓝色背景合成预览
bg2 = Image.new('RGB', (512, 512), (0, 100, 200))
bg2.paste(small, mask=small.split()[3])
bg2.save(r'F:\MinMax Code\0629\desktop-pet\skins\端午卜\preview-sleep-blue.png')

print('[done] previews saved')