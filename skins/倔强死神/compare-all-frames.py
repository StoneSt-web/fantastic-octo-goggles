"""对比所有 5 帧的 bbox"""
from PIL import Image
import numpy as np

frames = [
    ('idle', r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet.png"),
    ('blink', r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-eye-closed.png"),
    ('sleep', r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-sleep.png"),
    ('sing', r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-sing.png"),
    ('wave', r"F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-wave.png"),
]

print(f'{"name":<6} {"bbox_w":<7} {"bbox_h":<7} {"top":<5} {"bot":<5} {"left":<5} {"right":<5}')
print('-' * 50)
for name, f in frames:
    arr = np.array(Image.open(f).convert('RGBA'))
    m = arr[:, :, 3] > 10
    ys, xs = np.where(m)
    bbox_w = xs.max() - xs.min()
    bbox_h = ys.max() - ys.min()
    top = ys.min()
    bot = arr.shape[0] - 1 - ys.max()
    left = xs.min()
    right = arr.shape[1] - 1 - xs.max()
    print(f'{name:<6} {bbox_w:<7} {bbox_h:<7} {top:<5} {bot:<5} {left:<5} {right:<5}')