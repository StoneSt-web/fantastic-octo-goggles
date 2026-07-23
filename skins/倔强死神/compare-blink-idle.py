"""对比 idle 和 blink 帧的 bbox"""
from PIL import Image
import numpy as np

frames = [
    r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet.png",
    r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-eye-closed.png",
]
for f in frames:
    arr = np.array(Image.open(f).convert('RGBA'))
    m = arr[:, :, 3] > 10
    ys, xs = np.where(m)
    h, w = arr.shape[:2]
    bbox_w = xs.max() - xs.min()
    bbox_h = ys.max() - ys.min()
    print(f'{f.split(chr(92))[-1]}:')
    print(f'  canvas: {w}x{h}')
    print(f'  bbox: x=[{xs.min()},{xs.max()}] y=[{ys.min()},{ys.max()}]')
    print(f'  bbox size: {bbox_w}x{bbox_h}')
    print(f'  top margin: {ys.min()}px, bottom margin: {h - 1 - ys.max()}px')
    print(f'  left margin: {xs.min()}px, right margin: {w - 1 - xs.max()}px')
    print()