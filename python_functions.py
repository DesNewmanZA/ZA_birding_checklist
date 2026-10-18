#########################
# IMPORT NEEDED MODULES #
#########################
import requests
from collections import Counter
from datetime import date

###########################
# DEFINE NEEDED VARIABLES #
###########################
# SABAP2 endpoint for records - {start}, {end} and {pentad} are filled in per request
API_URL = "https://api.birdmap.africa/sabap2/v2/R/{start}/{end}/pentad/{pentad}/data"


###########################
# DEFINE HELPER FUNCTIONS #
###########################
def get_year_to_date_range():
    """Returns (start, end) as YYYY-MM-DD strings: 1 January of this year through today."""
    today = date.today()
    return f"{today.year}-01-01", today.strftime("%Y-%m-%d")


def get_previous_year_range():
    """Returns (start, end) as YYYY-MM-DD strings covering the span of the last year."""
    last_year = date.today().year - 1
    return f"{last_year}-01-01", f"{last_year}-12-31"


def _species_name(obs):
    """Builds a full bird name by joining species and type together e.g. 'Cape' + 'Robin-Chat' -> 'Cape Robin-Chat'."""
    parts = [obs.get("Common_species"), obs.get("Common_group")]
    return " ".join(" ".join(p for p in parts if p).split())


def fetch_bird_data(pentad, start_date, end_date):
    """
    Pulls SABAP2 observations for a pentad and ranks species by descending reporting rate.

    Args:
        pentad (str): pentad code of the form xxxx_yyyy
        start_date (str): start of the date range, YYYY-MM-DD
        end_date (str): end of the date range, YYYY-MM-DD

    Returns:
        dict:
            cards:   number of distinct atlas cards in the date range
            species: [{"name", "count", "pct"}, ...] sorted from most to least commonly recorded, where pct is the
            fraction of cards (0-1) the species appeared on.

    Raises:
        requests.RequestException: if the API request fails or times out
        ValueError: if the API response is not valid JSON
    """
    # Perform API call - timeout to prevent hanging
    resp = requests.get(API_URL.format(start=start_date, end=end_date, pentad=pentad), timeout=20)
    resp.raise_for_status()
    rows = resp.json().get("data") or []

    card_ids: set = set()
    seen_pairs: set[tuple[str, str]] = set()
    counts: Counter = Counter()
    for obs in rows:
        card, name = obs.get("CardNo"), _species_name(obs)
        if card is None or not name:
            continue
        card_ids.add(card)
        # Count each bird species only once per card
        if (card, name) not in seen_pairs:
            seen_pairs.add((card, name))
            counts[name] += 1

    total = len(card_ids)
    species = [
        {"name": n, "count": c, "pct": round(c / total, 4)}
        for n, c in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ]
    return {"cards": total, "species": species}
