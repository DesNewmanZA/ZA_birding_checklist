#########################
# IMPORT NEEDED MODULES #
#########################
import re
import requests
from datetime import date
from flask import Flask, jsonify, render_template, request
from python_functions import fetch_bird_data, get_year_to_date_range, get_previous_year_range

#######################################
# DEFINE NEEDED VARIABLES OR PATTERNS #
#######################################
# Pentad codes are of the form 4 digits underscore 4 digits - all other inputs must be rejected
PENTAD_RE = re.compile(r"^\d{4}_\d{4}$")
# # Minimum number of cards needed to use the current year's data, else default to prior year's data
MIN_CARDS = 3

##################
# MAIN FLASK APP #
##################
# Override static folder to public - this is to best work with Vercel hosting
app = Flask(__name__, static_folder="public", static_url_path="")


@app.route("/")
def index():
    """This serves the webpage - all checklist logic runs in the browser using app.js"""
    return render_template("index.html", year=date.today().year)


@app.route("/api/checklist")
def checklist():
    """
    Returns the ranked species list (from most common to rarest) for a pentad as JSON.

    Query parameters:
        pentad (str): pentad code of the form xxxx_yyyy

    Returns:
        JSON with pentad, year, start, end, cards, species and fallback (True if last year's data was used).
        On failure, JSON of the form {"error": ...} with status 400 (invalid pentad), 502 (SABAP2 request
        failed) or 504 (SABAP2 timed out) is returned.
    """

    # Get pentad string, if valid
    pentad = request.args.get("pentad", "")
    if not PENTAD_RE.match(pentad):
        return jsonify(error="Pentad must look like 3400_2300."), 400

    year = date.today().year
    start, end = get_year_to_date_range()
    fallback = False
    try:
        data = fetch_bird_data(pentad, start, end)
        # If there are not enough cards for the year, default to the prior year's data
        if data["cards"] < MIN_CARDS:
            prev_start, prev_end = get_previous_year_range()
            prev_data = fetch_bird_data(pentad, prev_start, prev_end)
            if prev_data["cards"] > data["cards"]:
                data, start, end, year, fallback = prev_data, prev_start, prev_end, year - 1, True
    except requests.Timeout:
        return jsonify(error="SABAP2 took too long to respond. Try again."), 504
    except (requests.RequestException, ValueError):
        # ValueError covers a response that isn't valid JSON
        return jsonify(error="Couldn't load data from SABAP2 for this pentad."), 502

    data.update(pentad=pentad, year=year, start=start, end=end, fallback=fallback)
    resp = jsonify(data)
    # Cache data for a day to reduce unnecessary API calls
    resp.headers["Cache-Control"] = "public, s-maxage=86400, stale-while-revalidate=86400"
    return resp


if __name__ == "__main__":
    app.run(debug=True)
