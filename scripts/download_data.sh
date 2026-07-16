#!/usr/bin/env bash
# Download the Spotify datasets from Kaggle's public API (no auth required).
# Idempotent: skips a dataset if its CSVs already exist.
set -euo pipefail

RAW_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/data/raw"
mkdir -p "$RAW_DIR"

# slug -> subdir
declare -A DATASETS=(
  ["zaheenhamidani/ultimate-spotify-tracks-db"]="genre"          # Dataset A: genre + audio features (no year)
  ["yamaerenay/spotify-dataset-19212020-600k-tracks"]="timeline" # Dataset B: 1921-2020, has year
)

for slug in "${!DATASETS[@]}"; do
  sub="${DATASETS[$slug]}"
  dest="$RAW_DIR/$sub"
  if compgen -G "$dest/*.csv" > /dev/null; then
    echo "[skip] $sub already has CSVs"
    continue
  fi
  mkdir -p "$dest"
  zip="$dest/dataset.zip"
  echo "[get ] $slug -> $dest"
  curl -sL -o "$zip" "https://www.kaggle.com/api/v1/datasets/download/$slug"
  # Sanity: must be a real zip
  if ! head -c4 "$zip" | grep -q "PK"; then
    echo "[err ] $slug did not return a zip (auth/geo?). First bytes:"; head -c120 "$zip"; echo; exit 1
  fi
  unzip -o -q "$zip" -d "$dest"
  rm -f "$zip"
  echo "[ok  ] $(ls "$dest"/*.csv | wc -l) csv(s) in $dest"
done

echo "Done. Raw data in $RAW_DIR"
