from collections import Counter
from datetime import date

import requests

API_URL = "https://api.birdmap.africa/sabap2/v2/R/{start}/{end}/pentad/{pentad}/data"


def get_year_to_date_range():
    """Return (start, end) as YYYY-MM-DD strings: 1 January of this year through today."""
    today = date.today()
    return f"{today.year}-01-01", today.strftime("%Y-%m-%d")


def _species_name(obs):
    """Build a clean display name, e.g. 'Cape' + 'Robin-Chat' -> 'Cape Robin-Chat'."""
    parts = [obs.get("Common_species"), obs.get("Common_group")]
    return " ".join(" ".join(p for p in parts if p).split())


def fetch_bird_data(pentad, start_date, end_date):
    """
    Pull SABAP2 full-protocol observations for a pentad and rank species by reporting rate.

    Returns a dict:
        cards:   number of distinct atlas cards in the date range
        species: [{"name", "count", "pct"}, ...] sorted most to least commonly recorded,
                 where pct is the fraction of cards (0-1) the species appeared on.
    """
    resp = requests.get(
        API_URL.format(start=start_date, end=end_date, pentad=pentad), timeout=20
    )
    resp.raise_for_status()
    rows = resp.json().get("data") or []

    card_ids, seen_pairs, counts = set(), set(), Counter()
    for obs in rows:
        card, name = obs.get("CardNo"), _species_name(obs)
        if card is None or not name:
            continue
        card_ids.add(card)
        if (card, name) not in seen_pairs:  # count each species once per card
            seen_pairs.add((card, name))
            counts[name] += 1

    total = len(card_ids)
    species = [
        {"name": n, "count": c, "pct": round(c / total, 4)}
        for n, c in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]
    return {"cards": total, "species": species}
