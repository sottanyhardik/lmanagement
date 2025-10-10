#!/bin/bash
set -euo pipefail

HOUR_WINDOW=1   # history window in hours

cutoff=$(python3 - <<PY
from datetime import datetime, timedelta
print(int((datetime.utcnow()-timedelta(hours=${HOUR_WINDOW})).timestamp()))
PY
)

echo "==> Starting Mac user cleanup"

########################################
# Safari history/cookies/cache (skip if running)
########################################
if pgrep -x "Safari" >/dev/null; then
  echo "Safari is running — skipping Safari cleanup."
else
  echo "Clearing Safari history, cookies, and cache..."
  SAF_DB="$HOME/Library/Safari/History.db"
  [ -f "$SAF_DB" ] && sqlite3 "$SAF_DB" "
    DELETE FROM history_visits
      WHERE (visit_time + 978307200) > ${cutoff};
    DELETE FROM history_items
      WHERE id NOT IN (SELECT history_item FROM history_visits);
    VACUUM;
  " 2>/dev/null || true

  rm -rf "$HOME/Library/Caches/com.apple.Safari" 2>/dev/null || true
  rm -f "$HOME/Library/Cookies/Cookies.binarycookies" 2>/dev/null || true
  rm -f "$HOME/Library/Safari/LastSession.plist" 2>/dev/null || true
fi

########################################
# Chrome history/cookies/cache (skip if running)
########################################
if pgrep -x "Google Chrome" >/dev/null; then
  echo "Google Chrome is running — skipping Chrome cleanup."
else
  echo "Clearing Chrome history, cookies, and cache..."
  CHROME_ROOT="$HOME/Library/Application Support/Google/Chrome"
  if [ -d "$CHROME_ROOT" ]; then
    for prof in "$CHROME_ROOT"/Default "$CHROME_ROOT"/Profile*; do
      [ -d "$prof" ] || continue
      DB="$prof/History"
      [ -f "$DB" ] && sqlite3 "$DB" "
        DELETE FROM urls
          WHERE (last_visit_time/1000000 - 11644473600) > ${cutoff};
        DELETE FROM visits
          WHERE (visit_time/1000000 - 11644473600) > ${cutoff};
        VACUUM;
      " 2>/dev/null || true

      rm -rf "$prof/Cache" "$prof/Code Cache" "$prof/GPUCache" 2>/dev/null || true
      rm -f "$prof/Cookies" 2>/dev/null || true
    done
  fi
fi

########################################
# User caches/logs/temp
########################################
echo "Clearing user caches/logs/temp…"
rm -rf ~/Library/Caches/* 2>/dev/null || true
rm -rf ~/Library/Logs/* 2>/dev/null || true
rm -rf /var/folders/*/*/* 2>/dev/null || true

########################################
# Delete specific files & folders
########################################
echo "Deleting matching files and folders…"

# File patterns
PATTERNS_FILES=(
  "*_TL.pdf" "*_TL.docx" "*_TL.docs"
  "TL_*.pdf" "TL_*.docx" "TL_*.docs"
  "*_TL *"                     # any filename containing "_TL " (underscore TL space)
  "Screenshot *" "Screenshot*.png" "Screenshot*.jpg" "Screenshot*.jpeg"
  "Allotment_*"
  "*WhatsApp*"
  "*_11zon*"
  "TL_*.zip"
)

# Folder patterns
PATTERNS_FOLDERS=(
  "TL_*"                       # any folder starting with TL_
)

# 1) Spotlight delete (fast)
for pat in "${PATTERNS_FILES[@]}"; do
  mdfind -0 "kMDItemFSName ==[c] \"$pat\"" | xargs -0 rm -f 2>/dev/null || true
done
for pat in "${PATTERNS_FOLDERS[@]}"; do
  mdfind -0 "kMDItemFSName ==[c] \"$pat\"" | xargs -0 rm -rf 2>/dev/null || true
done

# 2) Fallback deep scan (home, iCloud Drive, external volumes)
find "$HOME" \
     "$HOME/Library/Mobile Documents/com~apple~CloudDocs" \
     /Volumes \( \
     \( -type f \( \
       -name "*_TL.pdf" -o -name "*_TL.docx" -o -name "*_TL.docs" \
       -o -name "TL_*.pdf" -o -name "TL_*.docx" -o -name "TL_*.docs" \
       -o -name "*_TL *" \
       -o -name "Screenshot *" -o -name "Screenshot*.png" \
       -o -name "Screenshot*.jpg" -o -name "Screenshot*.jpeg" \
       -o -name "Allotment_*" \
       -o -name "*WhatsApp*" \
       -o -name "*_11zon*" \
       -o -name "TL_*.zip" \
     \) \) -o \
     \( -type d -name "TL_*" \) \
     \) -print0 2>/dev/null | while IFS= read -r -d '' item; do
       rm -rf "$item"
     done

# 3) Trash cleanup
for pat in "${PATTERNS_FILES[@]}" "${PATTERNS_FOLDERS[@]}"; do
  rm -rf ~/.Trash/$pat 2>/dev/null || true
done

echo "✅ Cleanup completed."
