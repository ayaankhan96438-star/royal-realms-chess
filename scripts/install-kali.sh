#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/home/chess}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$HOME/royal-realms-backups/chess-$STAMP"

if [[ "${EUID}" -eq 0 ]]; then
  echo "Please run this installer as your normal Linux user (e.g. ayaan), not root."
  exit 1
fi
if [[ ! -d "$PROJECT_DIR" ]]; then
  echo "Project directory not found: $PROJECT_DIR"
  exit 1
fi
if [[ ! -w "$PROJECT_DIR" ]]; then
  echo "You cannot write to $PROJECT_DIR. Fix ownership once with:"
  echo "sudo chown -R "$USER":"$USER" $PROJECT_DIR"
  exit 1
fi
if [[ ! -f "$SOURCE_DIR/package.json" || ! -f "$SOURCE_DIR/index.html" ]]; then
  echo "The extracted update is incomplete: $SOURCE_DIR"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
items=()
for name in index.html package.json package-lock.json src public scripts server README.md IMPLEMENTATION_STATUS.md THIRD_PARTY_NOTICES.md; do
  [[ -e "$PROJECT_DIR/$name" ]] && items+=("$name")
done
if ((${#items[@]})); then
  tar -czf "$BACKUP_DIR/project-backup.tar.gz" --exclude='node_modules' --exclude='dist' -C "$PROJECT_DIR" "${items[@]}"
fi

echo "Backup saved: $BACKUP_DIR/project-backup.tar.gz"
cp -a "$SOURCE_DIR/." "$PROJECT_DIR/"
cd "$PROJECT_DIR"

npm install
npm run copy-engine
npm run check
npm test
npm run build

echo
echo "Royal Realms Chess update installed and validated."
echo "Start frontend + private-room backend with: npm run start:all"
echo "Open: http://localhost:5173/"
