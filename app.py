import re
from datetime import date

import requests
from flask import Flask, jsonify, render_template, request

from python_functions import fetch_bird_data, get_year_to_date_range

# Static files live in /public so Vercel serves them from its CDN (and Flask serves them locally).
app = Flask(__name__, static_folder="public", static_url_path="")

PENTAD_RE = re.compile(r"^\d{4}_\d{4}$")


@app.route("/")
def index():
    return render_template("index.html", year=date.today().year)


@app.route("/api/checklist")
def checklist():
    pentad = request.args.get("pentad", "")
    if not PENTAD_RE.match(pentad):
        return jsonify(error="Pentad must look like 3400_2300."), 400

    start, end = get_year_to_date_range()
    try:
        data = fetch_bird_data(pentad, start, end)
    except requests.Timeout:
        return jsonify(error="SABAP2 took too long to respond. Try again."), 504
    except (requests.RequestException, ValueError):
        return jsonify(error="Couldn't load data from SABAP2 for this pentad."), 502

    data.update(pentad=pentad, year=date.today().year, start=start, end=end)
    resp = jsonify(data)
    # Cache at Vercel's edge: same pentad = same answer for an hour.
    resp.headers["Cache-Control"] = "public, s-maxage=3600, stale-while-revalidate=86400"
    return resp


if __name__ == "__main__":
    app.run(debug=True)
