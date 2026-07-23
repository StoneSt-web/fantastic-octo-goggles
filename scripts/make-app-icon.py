"""
从 skins/阳光天使/frames/pet.png 生成多尺寸 .ico 文件
electron-builder 用作应用图标(build/icon.ico)
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'skins', '阳光天使', 'frames', 'pet.png')
OUT_DIR = os.path.join(ROOT, 'build')
OUT_ICO = os.path.join(OUT_DIR, 'icon.ico')
OUT_ICNS_DIR = os.path.join(OUT_DIR, 'iconset')  # macOS 用

os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(OUT_ICNS_DIR, exist_ok=True)

# Windows .ico 含 16/32/48/64/128/256 多尺寸
ICO_SIZES = [16, 32, 48, 64, 128, 256]

# macOS .icns 含 16/32/64/128/256/512/1024 (1024 = 512@2x)
ICNS_SIZES = [16, 32, 64, 128, 256, 512, 1024]

print(f'[icon] loading {SRC}')
img = Image.open(SRC)
print(f'[icon] source size: {img.size}, mode: {img.mode}')

# 转 RGBA
if img.mode != 'RGBA':
    img = img.convert('RGBA')

# 生成 Windows .ico —— Pillow 会自动从原图 resize 到 sizes 数组里的每个尺寸
print(f'[icon] building icon.ico with sizes: {ICO_SIZES}')
img.save(
    OUT_ICO,
    format='ICO',
    sizes=[(s, s) for s in ICO_SIZES],
)
# 验证
import struct
with open(OUT_ICO, 'rb') as f:
    data = f.read()
reserved, type_, count = struct.unpack('<HHH', data[:6])
print(f'[icon] saved: {OUT_ICO} (count={count} sizes, {len(data)} bytes)')

# 生成 macOS iconset (electron-builder 期望 .icns 或 iconset)
print(f'[icon] building macOS iconset')
for s in ICNS_SIZES:
    out_path = os.path.join(OUT_ICNS_DIR, f'icon_{s}x{s}.png')
    resized = img.resize((s, s), Image.LANCZOS)
    resized.save(out_path, format='PNG')
    print(f'  {s}x{s} -> {out_path}')

print('[icon] done')
