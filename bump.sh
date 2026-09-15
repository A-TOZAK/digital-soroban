#!/bin/sh
# 作っているあいだ、ブラウザが古いファイルをつかまないように版番号を打ち直す。
# 公開のときは v=1 などの固定値に戻してよい。
V=$(date +%s)
for f in index.html about.html tests/test.html; do
  [ -f "$f" ] || continue
  sed -i '' -E "s/\?v=[0-9]+/?v=$V/g" "$f"
done
echo "版番号 → $V"
