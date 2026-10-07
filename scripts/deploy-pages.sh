#!/usr/bin/env bash
# dist/를 빌드해 gh-pages 브랜치에 올린다. GitHub Pages 소스가 gh-pages 브랜치(/ 루트)일 때 쓴다.
# 워크플로 파일 없이 배포하는 방식이라, 코드가 바뀌면 이 스크립트를 다시 실행해야 사이트가 갱신된다.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"
rev="$(git rev-parse --short HEAD)"

npm run build

tmp="$(mktemp -d)"
trap 'git worktree remove --force "$tmp" >/dev/null 2>&1 || true' EXIT

if git ls-remote --exit-code --heads origin gh-pages >/dev/null 2>&1; then
  git fetch -q origin gh-pages
  git worktree add -q -B gh-pages "$tmp" origin/gh-pages
else
  git worktree add -q --detach "$tmp"
  git -C "$tmp" checkout -q --orphan gh-pages
fi

git -C "$tmp" rm -rfq --ignore-unmatch .
git -C "$tmp" clean -fdxq
cp -R dist/. "$tmp/"
# Jekyll 처리를 끄지 않으면 밑줄로 시작하는 파일이 빠질 수 있다
touch "$tmp/.nojekyll"
git -C "$tmp" add -A
if git -C "$tmp" diff --cached --quiet; then
  echo "바뀐 내용이 없습니다."
  exit 0
fi
git -C "$tmp" commit -qm "DEPLOY: main ${rev} 빌드 결과"
git -C "$tmp" push -q origin gh-pages
echo "gh-pages에 배포했습니다 (main ${rev})."
