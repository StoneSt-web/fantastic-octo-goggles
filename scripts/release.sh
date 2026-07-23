#!/usr/bin/env bash
# 一键发布到 GitHub
# 用法: bash scripts/release.sh https://github.com/你的用户名/desktop-pet.git
#
# 流程:
#   1. git init(如果还没)
#   2. git remote add origin $REPO
#   3. git add . + commit
#   4. git push -u origin main
#   5. git tag v1.0.0
#   6. git push --tags
#   7. → GitHub Actions 自动跑 release.yml,生成 .exe + .dmg

set -e

REPO="$1"
if [ -z "$REPO" ]; then
  echo "❌ 用法: bash scripts/release.sh https://github.com/你的用户名/desktop-pet.git"
  exit 1
fi

cd "$(dirname "$0")/.."

echo "📁 当前目录: $(pwd)"
echo "🔗 目标仓库: $REPO"

# 1. git init
if [ ! -d .git ]; then
  echo "→ git init"
  git init
  git branch -M main
fi

# 2. 配 user(本地)
if [ -z "$(git config user.name)" ]; then
  echo "⚠️  请先配 git user.name + user.email:"
  echo "     git config --global user.name 你的名字"
  echo "     git config --global user.email 你的邮箱"
  exit 1
fi

# 3. remote
if ! git remote | grep -q origin; then
  echo "→ git remote add origin $REPO"
  git remote add origin "$REPO"
fi

# 4. 提交
echo "→ git add ."
git add .
echo "→ git commit -m 'v1.0.0'"
git commit -m "v1.0.0" --allow-empty

# 5. push
echo "→ git push -u origin main"
git push -u origin main

# 6. tag
if ! git tag | grep -q "v1.0.0"; then
  echo "→ git tag v1.0.0"
  git tag v1.0.0
fi

# 7. push tag → 触发 GitHub Actions
echo "→ git push --tags (触发 release.yml)"
git push origin v1.0.0

echo ""
echo "✅ 推送完成!"
echo ""
echo "📦 接下来:"
echo "   1. 打开 https://github.com/$(echo $REPO | sed 's|https://github.com/||;s|\.git$||')/actions"
echo "   2. 等待 'Release' workflow 跑完(5-10 分钟)"
echo "   3. 完成后看 https://github.com/$(echo $REPO | sed 's|https://github.com/||;s|\.git$||')/releases"
echo "   4. 下载 .exe / .dmg 安装包"
