"""全面检查用户截图中棋盘格的来源"""
from PIL import Image
import numpy as np

src = r'C:\Users\12690\.mavis\uploads\1783429345648-image.png'
img = Image.open(src).convert('RGB')
arr = np.array(img)
h, w = arr.shape[:2]
print(f'截图 size: {w}x{h}')

# 棋盘格是 PNG transparent 视觉表示
# 看到的是 zongzi 周围 + 内部 (zongzi 帽子上方、头顶) 都有棋盘格
# 这不是来自桌宠窗口内容，而是 PNG 文件中 zongzi 自身的非主体区域
# --- Zzz 文本颜色 ---
# 在 zongzi 的右上能看到 "z" 字母（Zzz）

# 关键问题：棋盘格 vs RGB 关系
# 棋盘格只有 alpha=0 时才能被 PNG render 显示
# 也就是说 zongzi 周围的 alpha 区域里有"主体"，但还是不显示

# 让我看 zongzi 周围所有 RGB 范围
print('\nzongzi 边缘的 RGB 抽样:')
# zongzi 大约在中央 (400, 200) 左右
# (粗略根据 852x408 全局缩放)
for y, x in [(180, 320), (170, 360), (190, 280), (210, 280), (200, 450), (220, 470), (170, 400), (200, 420)]:
    if y < h and x < w:
        print(f'  ({x},{y}): rgb={tuple(arr[y, x])}')

# 看 screenshot 边缘对比 - "棋盘格"区域通常 RGB 反复交替
print('\n"棋盘格"区域 RGB 检查 (zongzi 周围):')
# 抽样 zongzi 上方 (y=110, x=300-500)
for y in [110, 130, 150]:
    print(f'\ny={y}:')
    prev = None
    count = 0
    for x in range(280, 500, 20):
        rgb = tuple(arr[y, x])
        if rgb != prev:
            if prev is not None:
                print(f'    count={count}')
            print(f'    x={x}: rgb={rgb}', end='')
            count = 1
            prev = rgb
        else:
            count += 1
    print(f'    count={count}')