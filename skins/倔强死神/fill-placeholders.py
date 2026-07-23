"""
倔强死神占位帧填充（不动其他皮肤）

为 skins/死神倔强卜/frames/ 补齐 pet-eye-closed.png / pet-sleep.png / pet-surprised.png
3 个占位帧（直接复制 pet.png），让 bake 能输出"全 5 帧都是倔强死神"的效果。

只动倔强死神这一个皮肤的 frames/，不动端午卜、不动 assets/。
后续如果出 AI 重绘图，直接替换对应文件即可。
"""
import shutil
import sys
from pathlib import Path

SKIN = Path(__file__).resolve().parent
PET = SKIN / 'frames' / 'pet.png'

# 复用 pet.png 作为占位的 3 帧（保持当前激活皮肤的 PNG 自洽）
PLACEHOLDER_FRAMES = [
    'pet-eye-closed.png',
    'pet-sleep.png',
    'pet-surprised.png',
]

def main():
    if not PET.exists():
        print(f'ERROR: 找不到 {PET}', file=sys.stderr)
        sys.exit(1)

    for name in PLACEHOLDER_FRAMES:
        target = SKIN / 'frames' / name
        shutil.copy2(PET, target)
        print(f'  placeholder: {name}  (size={target.stat().st_size:,} bytes)')

    print(f'\nOK: 倔强死神 frames/ 补齐 3 个占位帧')
    print(f'  frames/ 现有:')
    for p in sorted((SKIN / 'frames').iterdir()):
        if p.is_file():
            print(f'    {p.name}  ({p.stat().st_size:,} bytes)')

if __name__ == '__main__':
    main()