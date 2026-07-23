"""创建阳光天使 skin 目录"""
import os

BASE = r'F:\MinMax Code\0629\desktop-pet\skins\阳光天使'
for sub in ['frames', 'prompts']:
    p = os.path.join(BASE, sub)
    os.makedirs(p, exist_ok=True)
    print(f'created: {p}')

print('done')