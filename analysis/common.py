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
