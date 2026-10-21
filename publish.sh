#!/bin/bash
# 사용: ./publish.sh ["커밋 메시지"]  — 글을 GitHub에 올립니다.
# 실제 빌드·배포는 GitHub Actions가 합니다(push 시 + 매일 자정 KST).
set -e
cd "$(dirname "$0")"
node build.js
git add -A
git diff --cached --quiet && { echo "변경 사항이 없습니다."; exit 0; }
git commit -m "${1:-글 업데이트}"
git push
echo "업로드 완료! 1~2분 뒤 사이트에 반영됩니다."
