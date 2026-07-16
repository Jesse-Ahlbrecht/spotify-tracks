"""Shared loaders, cleaning, and constants for the exploratory analysis.

Both datasets expose the same 9 continuous audio features; we standardize on those for
cross-realm comparability. Dataset A (genre) has no year; Dataset B (timeline) has release_date.
"""
from __future__ import annotations
from pathlib import Path
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
FIG = ROOT / "analysis" / "figures"
ART = ROOT / "app" / "public" / "data"
FIG.mkdir(parents=True, exist_ok=True)
ART.mkdir(parents=True, exist_ok=True)

# 9 continuous audio features shared by both datasets (loudness/tempo get scaled).
AUDIO = ["acousticness", "danceability", "energy", "instrumentalness",
         "liveness", "loudness", "speechiness", "tempo", "valence"]


def load_genre() -> pd.DataFrame:
    """Dataset A: genre + audio features (~232k rows, one row per (track, genre))."""
    df = pd.read_csv(RAW / "genre" / "SpotifyFeatures.csv")
    # Fix the duplicate apostrophe genre label.
    df["genre"] = df["genre"].str.replace("’", "'", regex=False)
    df = df.dropna(subset=["track_name"])
    return df


def load_timeline() -> pd.DataFrame:
    """Dataset B: timeline tracks (~587k). Adds `year` and `decade`; drops bad/outlier years."""
    df = pd.read_csv(RAW / "timeline" / "tracks.csv")
    yr = pd.to_datetime(df["release_date"], errors="coerce", format="mixed").dt.year
    df = df.assign(year=yr).dropna(subset=["year"])
    df = df[(df["year"] >= 1920) & (df["year"] <= 2021)].copy()
    df["year"] = df["year"].astype(int)
    df["decade"] = (df["year"] // 10 * 10).astype(int)
    df = df.dropna(subset=["name"])
    return df


def zscore(df: pd.DataFrame, cols=AUDIO) -> np.ndarray:
    """Standardize the given columns to zero-mean/unit-var; returns an ndarray."""
    x = df[cols].to_numpy(dtype=float)
    return (x - x.mean(0)) / x.std(0)


# Coarse "supergenre" buckets keyed off Spotify's fine-grained artist genres. First match wins,
# so ordering matters (e.g. 'pop rap' -> hip hop/rap before pop). Used to give dataset B a genre.
_SUPERGENRE = [
    ("hip hop/rap", ("hip hop", "rap", "trap")),
    ("rock", ("rock", "punk", "metal")),
    ("pop", ("pop",)),
    ("electronic", ("edm", "electro", "house", "techno", "dance")),
    ("r&b/soul", ("r&b", "soul", "funk")),
    ("country", ("country",)),
    ("jazz", ("jazz", "swing")),
    ("classical", ("classical", "orchestr", "opera")),
    ("folk", ("folk", "acoustic")),
    ("latin", ("latin", "reggaeton", "salsa")),
]


def _to_supergenre(genres: str) -> str:
    for name, kws in _SUPERGENRE:
        if any(k in genres for k in kws):
            return name
    return "other/none" if genres == "[]" else "other"


def attach_genre(df: pd.DataFrame) -> pd.DataFrame:
    """Give dataset B a genre: map each track's first `id_artists` entry to that artist's
    Spotify genres (from artists.csv), then bucket into a coarse `supergenre`. ~72% of tracks
    land in a named bucket; the rest are 'other'/'other/none'. Adds a `supergenre` column."""
    art = pd.read_csv(RAW / "timeline" / "artists.csv", usecols=["id", "genres"])
    genres_by_id = dict(zip(art["id"], art["genres"].fillna("[]")))
    # id_artists looks like "['id1', 'id2']"; grab the first quoted id (vectorized).
    first = df["id_artists"].str.extract(r"'([^']+)'", expand=False)
    gstr = first.map(genres_by_id).fillna("[]").str.lower()
    # Bucket the few thousand distinct genre strings, not all ~587k rows.
    lut = {g: _to_supergenre(g) for g in gstr.unique()}
    return df.assign(supergenre=gstr.map(lut))


def _fred_annual(name: str, how: str) -> pd.Series:
    """Read a FRED `fredgraph.csv` (its value column is named after the series id) that
    `download_data.sh` fetched into data/raw/econ/, aggregated to one value per year."""
    s = pd.read_csv(RAW / "econ" / f"{name}.csv", parse_dates=["observation_date"])
    year = s["observation_date"].dt.year.rename("year")
    return s.groupby(year)[name].agg(how)


def load_misery() -> pd.DataFrame:
    """US misery index (unemployment + inflation) per year. Indexed by `year`; columns
    unemployment / inflation / misery. Unemployment starts 1948, so `misery` is NaN before
    then; `inflation` (Dec-CPI YoY %) reaches back to ~1914."""
    unemp = _fred_annual("UNRATE", "mean")        # avg monthly rate
    cpi = _fred_annual("CPIAUCNS", "last")        # Dec index level
    out = pd.DataFrame({"unemployment": unemp, "inflation": cpi.pct_change() * 100})
    out["misery"] = out["unemployment"] + out["inflation"]
    return out


def load_sentiment() -> pd.Series:
    """US consumer sentiment (U. Michigan), annual mean, indexed by `year` (1952+). A
    *perceived*-conditions survey — contrast with the objective misery index. From FRED UMCSENT."""
    return _fred_annual("UMCSENT", "mean").rename("sentiment")
