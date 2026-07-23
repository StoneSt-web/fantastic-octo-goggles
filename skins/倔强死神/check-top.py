"""检查 pet-sing.png 顶部 200px 范围内的 alpha 分布，看镰刀/头罩顶端是否被错误透明化"""
from PIL import Image
import numpy as np

img = Image.open(r'F:\MinMax Code\0629\desktop-pet\skins\死神倔强卜\frames\pet-sing.png').convert('RGBA')
arr = np.array(img)
alpha = arr[:, :, 3]

# 顶部 200px 逐行统计 alpha>10 的像素数
print('top 200 rows alpha stats (alpha>10 像素数):')
for y in range(0, 200, 10):
    cnt = (alpha[y] > 10).sum()
    if cnt > 0:
        # 看这些像素的颜色范围
        row = arr[y]
        visible = row[alpha[y] > 10]
        if len(visible) > 0:
            r_avg = visible[:, 0].mean()
            g_avg = visible[:, 1].mean()
            b_avg = visible[:, 2].mean()
            print(f'  y={y:3d}: count={cnt:4d}, avg_rgb=({r_avg:.0f},{g_avg:.0f},{b_avg:.0f})')
        else:
            print(f'  y={y:3d}: count=0')
    else:
        print(f'  y={y:3d}: count=0 (全透明)')

print()
print('整体 bbox 检查 (alpha>10):')
mask = alpha > 10
ys, xs = np.where(mask)
print(f'  bbox: x=[{xs.min()},{xs.max()}], y=[{ys.min()},{ys.max()}]')
print(f'  top margin: {ys.min()}px')

# 看 y=80 那一行（top margin 处）有什么
print()
print('y=80 row 内容 (rgb):')
for x in range(0, 2048, 50):
    if alpha[80, x] > 10:
        print(f'  x={x}: rgb=({arr[80,x,0]},{arr[80,x,1]},{arr[80,x,2]}) alpha={alpha[80,x]}')