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

# US economic series for the mood-over-time overlay (FRED, also no auth).
# UNRATE  = civilian unemployment %, monthly 1948+
# CPIAUCNS= CPI index, monthly 1913+ (-> YoY inflation gives the longest history)
# UMCSENT = U. Michigan consumer sentiment (how people *feel*), monthly 1952+
econ="$RAW_DIR/econ"
mkdir -p "$econ"
for id in UNRATE CPIAUCNS UMCSENT; do
  out="$econ/$id.csv"
  if [ -s "$out" ]; then echo "[skip] econ/$id.csv"; continue; fi
  echo "[get ] FRED $id -> $out"
  curl -sL -o "$out" "https://fred.stlouisfed.org/graph/fredgraph.csv?id=$id"
  if ! head -1 "$out" | grep -qi "observation_date"; then
    echo "[err ] FRED $id did not return a csv. First bytes:"; head -c120 "$out"; echo; exit 1
  fi
  echo "[ok  ] $(wc -l < "$out") rows in econ/$id.csv"
done

echo "Done. Raw data in $RAW_DIR"
