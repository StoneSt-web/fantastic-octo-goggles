"""Win32 DWM 透明窗口适配: 所有 alpha=0 像素 RGB 归零。"""
from PIL import Image
import numpy as np
import os

frames_dir = r'F:\MinMax Code\0629\desktop-pet\skins\阳光天使\frames'

for n in ['idle', 'blink', 'sleep', 'sing', 'wave']:
    p = f'{frames_dir}\\aligned-{n}.png'
    img = Image.open(p).convert('RGBA')
    arr = np.array(img)
    H, W = arr.shape[:2]
    # 改 alpha=0 像素 RGB = (0,0,0)
    transparent = arr[:,:,3] == 0
    n_trans = transparent.sum()
    arr[transparent, 0] = 0
    arr[transparent, 1] = 0
    arr[transparent, 2] = 0
    out = Image.fromarray(arr, mode='RGBA')
    out.save(p, optimize=True)
    print(f'{n}: reset {n_trans} transparent pixels to RGB=(0,0,0)')

# 最后合成预览
print('\n=== 蓝底 preview ===')
for n in ['idle', 'blink', 'sleep', 'sing', 'wave']:
    p = f'{frames_dir}\\aligned-{n}.png'
    img = Image.open(p)
    bg = Image.new('RGB', img.size, (0, 174, 252))
    bg.paste(img.convert('RGBA'), mask=img.convert('RGBA').split()[-1])
    out = f'{frames_dir}\\preview-aligned-{n}.png'
    bg.save(out, optimize=True)
    print(f'  {out}')
