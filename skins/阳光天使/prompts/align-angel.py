"""对齐 5 帧: 主体 bbox 完全一致 (top, bottom, left, right 一致)。"""
from PIL import Image
import numpy as np

frames_dir = r'F:\MinMax Code\0629\desktop-pet\skins\阳光天使\frames'
TARGET = 1024

def get_opaque_bbox(img_rgba, exclude_top_pct=0.20):
    """主体 bbox (排除顶部 halo 区)。"""
    arr = np.array(img_rgba)
    H, W = arr.shape[:2]
    if arr.shape[2] == 4:
        alpha = arr[:,:,3]
    else:
        return (0, 0, W-1, H-1)
    opaque = alpha > 10

    # 排除顶部 (halo 上方的全空)
    y_start = int(H * exclude_top_pct)
    body = opaque[y_start:, :]
    if not body.any():
        return None
    ys, xs = np.where(body)
    return (int(xs.min()), int(ys.min()) + y_start, int(xs.max()), int(ys.max()) + y_start)

def get_full_bbox(img_rgba):
    arr = np.array(img_rgba)
    if arr.shape[2] == 4:
        opaque = arr[:,:,3] > 10
    else:
        opaque = np.ones(arr.shape[:2], dtype=bool)
    if not opaque.any():
        return None
    ys, xs = np.where(opaque)
    return (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))

# 1. idle 当基准: 缩到 1024, 算主体 bbox
idle = Image.open(f'{frames_dir}\\idle.png').convert('RGBA')
idle_1024 = idle.resize((TARGET, TARGET), Image.LANCZOS)
idle_main = get_opaque_bbox(idle_1024)
print(f'idle main bbox (1024): {idle_main}')

# 缩放后, 我们要的是 主体 bbox 中心 + 主体宽高
# 对齐策略: 让所有帧的主体 bbox 在 1024 上跟 idle 完全一致
target_bbox = idle_main  # (x_min, y_min, x_max, y_max)

# 2. 处理每帧: 缩放到 1024, 计算主体 bbox 当前尺寸, 然后精确对齐
def align_frame(name):
    img = Image.open(f'{frames_dir}\\{name}.png').convert('RGBA')
    src_main = get_opaque_bbox(img)
    if src_main is None:
        return None
    sb_w = src_main[2] - src_main[0]
    sb_h = src_main[3] - src_main[1]
    tb_w = target_bbox[2] - target_bbox[0]
    tb_h = target_bbox[3] - target_bbox[1]

    # 宽度对齐: scale_w = tb_w / sb_w
    # 高度对齐: scale_h = tb_h / sb_h
    # 取平均(等比例保持)
    scale = (tb_w / sb_w + tb_h / sb_h) / 2
    new_w = int(img.width * scale)
    new_h = int(img.height * scale)
    img_s = img.resize((new_w, new_h), Image.LANCZOS)

    # 主体在新图中的位置
    new_sub_left = int(src_main[0] * scale)
    new_sub_top = int(src_main[1] * scale)
    new_sub_w = int(sb_w * scale)
    new_sub_h = int(sb_h * scale)

    # 计算 paste 偏移: 让主体的中心对齐到 target_bbox 的中心
    target_cx = (target_bbox[0] + target_bbox[2]) // 2
    target_cy = (target_bbox[1] + target_bbox[3]) // 2
    new_sub_cx = new_sub_left + new_sub_w // 2
    new_sub_cy = new_sub_top + new_sub_h // 2

    paste_x = target_cx - new_sub_cx
    paste_y = target_cy - new_sub_cy

    bg = Image.new('RGBA', (TARGET, TARGET), (0, 0, 0, 0))
    bg.paste(img_s, (paste_x, paste_y), img_s)
    return bg

results = {}
for n in ['idle', 'blink', 'sleep', 'sing', 'wave']:
    if n == 'idle':
        # idle 自己: 缩到 1024 即可, 主 bbox 自然对齐 (target_bbox 就是它的)
        out = idle_1024
    else:
        out = align_frame(n)
        if out is None:
            print(f'{n}: failed')
            continue
    out_path = f'{frames_dir}\\aligned-{n}.png'
    out.save(out_path, optimize=True)
    bbox = get_opaque_bbox(out)
    print(f'aligned-{n}: bbox={bbox} w={bbox[2]-bbox[0]} h={bbox[3]-bbox[1]}')

# 验证全部 5 帧 bbox 一致
print('\n=== 一致性验证 ===')
ref = None
for n in ['idle', 'blink', 'sleep', 'sing', 'wave']:
    p = f'{frames_dir}\\aligned-{n}.png'
    img = Image.open(p).convert('RGBA')
    bbox = get_opaque_bbox(img)
    if ref is None:
        ref = bbox
    delta = (bbox[0]-ref[0], bbox[1]-ref[1], bbox[2]-ref[2], bbox[3]-ref[3])
    print(f'  {n}: bbox={bbox} delta_from_idle={delta}')
