"""把所有 PNG 的 alpha=0 区域的 RGB 重置为 0,0,0
这样 Electron transparent 窗口在 win32 上能正确穿透"""
from PIL import Image
import numpy as np
import os

DIR = r'F:\MinMax Code\0629\desktop-pet\skins\端午卜\frames'
TARGET_RGB = np.array([0, 0, 0], dtype=np.uint8)

# 只处理当前可能用到的 PNG (那些还没有 "pet-original" 标记的)
# 实际上：纯 RGB=0 + alpha=0 = 完美透明
files = [
    'pet-idle.png', 'pet-blink.png', 'pet-sleep.png', 'pet-sing.png',
    'pet-original.png', 'pet-wave.png', 'pet-surprised.png',
]

for fname in files:
    p = os.path.join(DIR, fname)
    if not os.path.exists(p):
        continue
    img = Image.open(p)
    if img.mode != 'RGBA':
        print(f'[{fname}] mode={img.mode}, skip')
        continue
    arr = np.array(img).copy()
    h, w = arr.shape[:2]

    zero_alpha = arr[:, :, 3] == 0
    n_zero = zero_alpha.sum()

    # 还要包括"低 alpha"(<10) 的像素 - 这些是抗锯齿边缘残留
    low_alpha = (arr[:, :, 3] > 0) & (arr[:, :, 3] < 10)
    n_low = low_alpha.sum()

    # 只改 alpha=0 的 (低 alpha 是真实边缘，不能动)
    arr[zero_alpha, 0] = 0
    arr[zero_alpha, 1] = 0
    arr[zero_alpha, 2] = 0

    out = Image.fromarray(arr)
    out.save(p, optimize=True)

    print(f'[{fname}] {w}x{h}: alpha=0 像素 {n_zero} ({100*n_zero/(w*h):.1f}%) 重置 RGB 为 0; low-alpha {n_low}')

print('\n[done]')