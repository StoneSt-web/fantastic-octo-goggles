"""List skin directories"""
import os
SKINS = r'F:\MinMax Code\0629\desktop-pet\skins'
for skin in os.listdir(SKINS):
    full = os.path.join(SKINS, skin)
    if not os.path.isdir(full):
        continue
    print(f'\n[{skin}]')
    frames_dir = os.path.join(full, 'frames')
    if os.path.exists(frames_dir):
        for f in sorted(os.listdir(frames_dir)):
            print(f'  {f}')
    prompts_dir = os.path.join(full, 'prompts')
    if os.path.exists(prompts_dir):
        for f in sorted(os.listdir(prompts_dir)):
            print(f'  prompts/{f}')