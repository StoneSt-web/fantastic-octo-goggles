#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
make-icns.py — 从 build/iconset/ 生成 build/icon.icns (macOS 图标)

不依赖 iconutil(macOS 专属),用纯 Python 拼 ICNS 容器格式。
格式参考: https://en.wikipedia.org/wiki/Apple_Icon_Image

ICNS 容器 = 8 字节 header + N 个 icon block
  - header:  4 bytes "icns" + 4 bytes total file size (big-endian)
  - block:   4 bytes type code + 4 bytes block size (含 8 字节头) + data

标准 type code:
  icp4 = 16x16        icp5 = 32x32        icp6 = 64x64
  ic07 = 128x128      ic08 = 256x256      ic09 = 512x512
  ic10 = 512x512@2x (1024x1024)
"""

import os
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
ICONSET = ROOT / "build" / "iconset"
OUTPUT = ROOT / "build" / "icon.icns"

# 尺寸 → type code
SIZE_TO_TYPE = {
    16: "icp4",
    32: "icp5",
    64: "icp6",
    128: "ic07",
    256: "ic08",
    512: "ic09",
    1024: "ic10",  # macOS 当 512x512@2x
}


def main() -> int:
    if not ICONSET.exists():
        print(f"[ERR] iconset 目录不存在: {ICONSET}")
        return 1

    # 收集所有 png
    pngs = sorted(ICONSET.glob("icon_*x*.png"))
    if not pngs:
        print(f"[ERR] iconset 里没找到 icon_*x*.png")
        return 1

    # 按尺寸排序
    blocks: list[tuple[str, int, bytes]] = []
    for png_path in pngs:
        # 解析尺寸: icon_1024x1024.png → 1024
        stem = png_path.stem  # icon_1024x1024
        try:
            size = int(stem.split("_")[1].split("x")[0])
        except (IndexError, ValueError):
            print(f"[SKIP] 解析尺寸失败: {png_path.name}")
            continue

        type_code = SIZE_TO_TYPE.get(size)
        if not type_code:
            print(f"[SKIP] 非标尺寸 {size}px: {png_path.name}")
            continue

        png_data = png_path.read_bytes()
        blocks.append((type_code, size, png_data))
        print(f"  + {png_path.name} ({size}px, {len(png_data)} bytes) → {type_code}")

    if not blocks:
        print("[ERR] 没有可用的图标块")
        return 1

    # 计算总大小
    total_data = sum(len(data) for _, _, data in blocks)
    total_size = 8 + sum(8 + len(data) for _, _, data in blocks)  # 8 = header

    # 拼装
    buf = bytearray()
    buf.extend(b"icns")
    buf.extend(struct.pack(">I", total_size))
    for type_code, size, data in blocks:
        block_size = 8 + len(data)
        buf.extend(type_code.encode("ascii"))
        buf.extend(struct.pack(">I", block_size))
        buf.extend(data)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(buf)

    print()
    print(f"[OK] 生成: {OUTPUT}")
    print(f"     块数: {len(blocks)}, 总大小: {total_size} bytes ({total_size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
