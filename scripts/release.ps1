# One-click publish to GitHub (PowerShell version)
# Usage: .\scripts\release.ps1 -Repo "https://github.com/yourname/desktop-pet.git"
#
# Steps:
#   1. git init (if not)
#   2. git remote add origin $Repo
#   3. git add . + commit
#   4. git push -u origin main
#   5. git tag v1.0.0
#   6. git push --tags
#   7. -> GitHub Actions runs release.yml, generates .exe + .dmg

param(
  [Parameter(Mandatory=$true)]
  [string]$Repo
)

Set-Location $PSScriptRoot\..
$Root = Get-Location

Write-Host "[INFO] Working dir: $Root" -ForegroundColor Cyan
Write-Host "[INFO] Target repo: $Repo" -ForegroundColor Cyan

# 1. git init
if (-not (Test-Path .git)) {
  Write-Host "[STEP] git init" -ForegroundColor Yellow
  git init
  git branch -M main
}

# 2. Configure user (local)
$userName = git config user.name
if (-not $userName) {
  Write-Host "[ERROR] Please configure git user.name + user.email first:" -ForegroundColor Red
  Write-Host "     git config --global user.name YourName"
  Write-Host "     git config --global user.email you@example.com"
  exit 1
}

# 3. remote
$remotes = git remote
if ($remotes -notcontains "origin") {
  Write-Host "[STEP] git remote add origin $Repo" -ForegroundColor Yellow
  git remote add origin $Repo
}

# 4. Commit
Write-Host "[STEP] git add ." -ForegroundColor Yellow
git add .
Write-Host "[STEP] git commit -m 'v1.0.0'" -ForegroundColor Yellow
git commit -m "v1.0.0" --allow-empty

# 5. push
Write-Host "[STEP] git push -u origin main" -ForegroundColor Yellow
git push -u origin main

# 6. tag
$tags = git tag
if ($tags -notcontains "v1.0.0") {
  Write-Host "[STEP] git tag v1.0.0" -ForegroundColor Yellow
  git tag v1.0.0
}

# 7. push tag -> triggers GitHub Actions
Write-Host "[STEP] git push --tags (triggers release.yml)" -ForegroundColor Yellow
git push origin v1.0.0

Write-Host ""
Write-Host "[OK] Push complete!" -ForegroundColor Green
Write-Host ""
Write-Host "[NEXT] Steps:" -ForegroundColor Magenta
$cleanUrl = $Repo -replace '\.git$', ''
Write-Host "   1. Open $cleanUrl/actions"
Write-Host "   2. Wait for 'Release' workflow to finish (5-10 min)"
Write-Host "   3. Go to $cleanUrl/releases to download .exe / .dmg"
