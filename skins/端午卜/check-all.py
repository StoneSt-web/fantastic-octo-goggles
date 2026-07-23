"""检查端午 zongzi 所有帧的 alpha"""
from PIL import Image
import numpy as np

skin = r'F:\MinMax Code\0629\desktop-pet\skins\端午卜\frames'
import os
for f in ['pet.png', 'pet-eye-closed.png', 'pet-sleep.png', 'pet-sing.png', 'pet-surprised.png']:
    p = os.path.join(skin, f)
    img = Image.open(p).convert('RGBA')
    arr = np.array(img)
    a = arr[:, :, 3]
    print(f'{f}:')
    print(f'  alpha=0: {(a==0).sum()} ({(a==0).sum()/a.size*100:.1f}%)')
    print(f'  alpha=255: {(a==255).sum()}')
    print(f'  semi (1-254): {((a>0)&(a<255)).sum()}')