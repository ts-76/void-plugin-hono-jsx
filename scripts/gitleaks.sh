#!/usr/bin/env bash
set -euo pipefail
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) asset=darwin_arm64; checksum=b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5 ;;
  Linux-x86_64) asset=linux_x64; checksum=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb ;;
  *) echo 'Use an existing gitleaks v8.30.1 on this platform' >&2; exit 1 ;;
esac
temp=$(mktemp -d)
trap 'rm -rf "$temp"' EXIT
archive="gitleaks_8.30.1_${asset}.tar.gz"
curl --fail --location --silent --show-error --connect-timeout 15 --max-time 60 "https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/$archive" --output "$temp/$archive"
echo "$checksum  $temp/$archive" | shasum -a 256 -c -
tar -xzf "$temp/$archive" -C "$temp" gitleaks
# Scan source files in the working tree, including untracked, excluding ignored dependencies/output.
mkdir "$temp/source"
git ls-files -z --cached --others --exclude-standard | while IFS= read -r -d '' file; do
  mkdir -p "$temp/source/$(dirname "$file")"
  cp "$file" "$temp/source/$file"
done
"$temp/gitleaks" dir "$temp/source" --config "$PWD/.gitleaks.toml" --redact --no-banner
"$temp/gitleaks" git . --config "$PWD/.gitleaks.toml" --log-opts=--all --redact --no-banner
