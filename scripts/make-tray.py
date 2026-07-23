"""
通用 tray-icon 生成工具

用法:
    python scripts/make-tray.py --skin <skin-id>
    python scripts/make-tray.py --skin <skin-id> --source pet-eye-closed.png

默认从 skins/<skin-id>/frames/pet.png 取主体,生成 32x32 RGBA PNG
"""
import argparse
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SKINS = ROOT / 'skins'


def make_tray_icon(skin_id: str, source_file: str = 'pet.png', target_size: int = 32):
    src = SKINS / skin_id / 'frames' / source_file
    dst = SKINS / skin_id / 'frames' / 'tray-icon.png'
    preview = SKINS / skin_id / 'frames' / 'tray-icon-preview.png'

    if not src.exists():
        raise FileNotFoundError(f'source 不存在: {src}')

    img = Image.open(src).convert('RGBA')
    W, H = img.size
    print(f'[make-tray] {skin_id}: 源图 {source_file} = {W}x{H}')

    # 找内容 bbox
    arr = np.array(img)
    if arr.shape[2] == 4:
        opaque = arr[:, :, 3] > 10
    else:
        # RGB 模式 - 假定非白色为内容
        opaque = (arr[:, :, 0] < 245) | (arr[:, :, 1] < 245) | (arr[:, :, 2] < 245)

    if not opaque.any():
        raise ValueError(f'无可用内容: {src}')

    ys, xs = np.where(opaque)
    bbox = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
    print(f'  content bbox: {bbox} (w={bbox[2]-bbox[0]}, h={bbox[3]-bbox[1]})')

    subject = img.crop(bbox)
    sw, sh = subject.size

    # 缩放到 30x30 (留 1px 内边距)
    INNER = target_size - 2
    scale = min(INNER / sw, INNER / sh)
    new_w = max(1, int(sw * scale))
    new_h = max(1, int(sh * scale))
    subject_small = subject.resize((new_w, new_h), Image.LANCZOS)
    print(f'  resized: {new_w}x{new_h} (pad={(target_size - new_w)//2},{(target_size - new_h)//2})')

    out = Image.new('RGBA', (target_size, target_size), (0, 0, 0, 0))
    paste_x = (target_size - new_w) // 2
    paste_y = (target_size - new_h) // 2
    out.paste(subject_small, (paste_x, paste_y), subject_small)

    out.save(dst, optimize=True)
    print(f'  saved: {dst} ({dst.stat().st_size} bytes, {out.size} {out.mode})')

    # 黑色背景预览(任务栏实际是黑底)
    prev = Image.new('RGB', (target_size * 4, target_size * 4), (0, 0, 0))
    prev.paste(out, (target_size, target_size), out)
    prev.save(preview, optimize=True)
    print(f'  preview (黑底): {preview}')

    return dst


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='生成 skin 的 tray-icon.png (32x32 RGBA)')
    ap.add_argument('--skin', required=True, help='skin id (目录名)')
    ap.add_argument('--source', default='pet.png', help='源文件名 (默认 pet.png)')
    ap.add_argument('--size', type=int, default=32, help='目标尺寸 (默认 32)')
    args = ap.parse_args()
    make_tray_icon(args.skin, args.source, args.size)