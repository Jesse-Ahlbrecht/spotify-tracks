"""Export compact JSON artifacts for the React app straight from the analysis loaders,
so the app's numbers match notebook 03 exactly. All derivation (aggregation, the
economy join + z-scoring) happens here — the app only reads and renders.

Run:  python scripts/export_app_data.py
Out:  app/public/data/{timeline,tracks,world}.json
"""
from __future__ import annotations
import ast
import json
import sys
import pathlib

import pandas as pd

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "analysis"))
from common import load_timeline, load_misery, load_sentiment, ART  # noqa: E402

FEATS = ["valence", "energy", "danceability"]


def r(x, n=3):
    return round(float(x), n)


def none_or(x, n):
    return r(x, n) if pd.notna(x) else None


def main():
    df = load_timeline()
    df["minor"] = df["mode"] == 0                                    # 0 = minor key
    df["sad_banger"] = (df["valence"] < 0.5) & (df["energy"] > 0.5)  # low-valence + high-energy

    # --- per-decade dials the journey + beats read ---
    def agg(g):
        return {
            "valence": r(g.valence.mean()),
            "energy": r(g.energy.mean()),
            "danceability": r(g.danceability.mean()),
            "minor_share": r(g.minor.mean()),
            "sad_banger": r(g.sad_banger.mean()),
            "acousticness": r(g.acousticness.mean()),
        }

    timeline = {"decades": [{"decade": int(d), **agg(g)} for d, g in df.groupby("decade")]}

    # --- representative tracks per decade (for the Spotify embeds) ---
    # Recognizable (top popularity) AND near the decade's mood centroid, so the embed
    # sounds like that point on the journey.
    z = (df[FEATS] - df[FEATS].mean()) / df[FEATS].std()
    centroid = z.assign(decade=df.decade.values).groupby("decade")[FEATS].mean()

    def first_artist(s):
        try:
            lst = ast.literal_eval(s)
            return lst[0] if lst else "Unknown"
        except (ValueError, SyntaxError):
            return str(s)

    tracks = {}
    for d, g in df.groupby("decade"):
        top = g.sort_values("popularity", ascending=False).head(40)
        dist = ((z.loc[top.index] - centroid.loc[d]) ** 2).sum(axis=1)
        pick = top.loc[dist.sort_values().index[:3]]
        tracks[str(int(d))] = [
            {"id": row["id"], "name": row["name"], "artist": first_artist(row["artists"])}
            for _, row in pick.iterrows()
        ]

    # --- music mood vs the world, joined + z-scored here (one axis in the app) ---
    valence_by_year = df.groupby("year")["valence"].mean()
    world = load_misery()[["misery"]].join(load_sentiment()).join(valence_by_year.rename("valence"))
    world = world[(world.index >= 1920) & (world.index <= 2021)]
    world = world[world["misery"].notna() | world["sentiment"].notna()]
    for c in ["valence", "misery", "sentiment"]:
        world[f"{c}_z"] = (world[c] - world[c].mean()) / world[c].std()
    world_out = [
        {
            "year": int(y),
            "valence": none_or(row.valence_z, 2),
            "misery": none_or(row.misery_z, 2),
            "sentiment": none_or(row.sentiment_z, 2),
        }
        for y, row in world.iterrows()
    ]

    ART.mkdir(parents=True, exist_ok=True)
    for name, obj in [("timeline", timeline), ("tracks", tracks), ("world", world_out)]:
        p = ART / f"{name}.json"
        p.write_text(json.dumps(obj, separators=(",", ":")))
        print(f"wrote {p.relative_to(ART.parents[2])}  ({p.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
