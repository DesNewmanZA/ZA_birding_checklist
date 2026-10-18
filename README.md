# ZA_birding_checklist - Tickbird
Tickbird is a small birding companion that builds custom bird checklists for Southern Africa using data from the Southern African Bird Atlas Project 2 (SABAP2). By combining atlas data with a user-selected pentad, Tickbird provides an up-to-date picture of which species have been recorded in a particular area, helping birders get a better idea of what they might encounter in the field.

Distribution maps and field guides show where birds can be found in general; Tickbird uses recent observations submitted by birders to keep its checklists as current as possible. It retrieves the cards submitted to SABAP2 during the current calendar year. If fewer than three cards have been submitted for the pentad this year, it falls back to the previous year's data (provided that year has more cards), as a handful of cards makes for a very thin checklist.

The aim isn't to replace existing birding apps or checklists, but rather to complement them with a location-specific, data-driven tool. Whether you're exploring a new area, checking a sighting against local records while learning to identify birds, or turning a familiar patch into a birding challenge, Tickbird helps you discover what's been seen nearby and keep track of your own sightings. It is designed to be simple and convenient for short birding outings.

Getting started is simple: select a pentad using your location, choose a spot on the map, or enter a pentad code manually. Tickbird retrieves the available cards for that pentad and ranks recorded species from most to least frequently recorded. You can then work through the checklist and tick off the birds you spot along the way.

### Why I built Tickbird
I'm a birding enthusiast, and I'm always on the lookout for birds in my daily life. I sometimes battle to identify the trickier ones, and I also like keeping lists and turning things into games.

The first version of this idea was my project submission for Day 96 of the 100 Days of Python bootcamp ([view the original](https://github.com/DesNewmanZA/Python_bootcamp/tree/main/Coding%20exercises/Day_96)). It worked for one specific pentad, capturing Leisure Isle in Knysna, one of my favourite birding spots, and it was never hosted. 

I wanted a version that adapts to wherever I am at any given time and that I can use on my phone, and Vercel's free hosting did the trick. 

### What is a pentad?
A pentad is the grid square SABAP2 uses to organise its records: five minutes of latitude by five minutes of longitude. Each pentad has a code made from the position of its north-west corner, for example `3400_2300`.

### How species are ranked
SABAP2 calls each submitted checklist a card (Tickbird's screens call them submissions). Each species is ranked by the percentage of cards for the pentad that it was recorded on. The checklist runs from most to least frequently recorded, and the "How you're doing" panel shows how many species you've ticked off in each of the following groups:

- **Common**: recorded on 50% or more of cards.
- **Regular**: recorded on 10% to just under 50% of cards.
- **Scarce**: recorded on less than 10% of cards.

### Privacy
Your checklist ticks, your last location, and a copy of recently loaded checklist data are stored locally in your browser, and nothing is synchronised to an account. Your coordinates are never sent to Tickbird's server: your browser works out the pentad code and sends only that. Map tiles are loaded from OpenStreetMap, which can see the map area being viewed, and Tickbird also uses Vercel Web Analytics to count page views in aggregate.


## Technology Stack

| Component         | Technology               |
|-------------------|--------------------------|
| Backend           | Python, Flask            |
| Frontend          | JavaScript, HTML and CSS |
| Mapping           | Leaflet                  |
| Map tiles         | OpenStreetMap            |
| Data source       | SABAP2                   |
| Local persistence | Browser local storage    |
| Hosting           | Vercel                   |
| Analytics         | Vercel Web Analytics     |

## Project Structure

The following files and directories are relevant to the application.

```text
.
├── app.py                  # Flask application and API endpoint
├── python_functions.py     # SABAP2 data retrieval and date-range helpers
├── requirements.txt        # Python dependencies (Flask, Requests)
├── templates/
│   └── index.html          # Main application page
└── public/                 # Static files, served from the site root
    ├── app.js              # Frontend checklist logic
    ├── style.css           # Styles, including dark mode
    └── favicon.svg, favicon-32.png, apple-touch-icon.png   # Icons
```

## Running Locally

### Prerequisites

- Python 3.9 or newer
- An internet connection, as checklists are pulled live from SABAP2

### Setup

1. Clone or download the repository.

2. Navigate to the project directory.

3. Install the required Python dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Start the Flask application:

   ```bash
   python app.py
   ```

5. Open the local address displayed by Flask.

Geolocation only works on localhost or HTTPS addresses. If you want to test "Use my location" on a phone, deploy the app (for example, to Vercel) and open the HTTPS address.

Vercel Web Analytics only records visits once it's enabled for the project in Vercel, so the analytics script is not active when running locally.

## API

### `GET /api/checklist`

Retrieves the ranked species checklist for a specified pentad.

**Query parameter**

| Parameter | Description                           | Example     |
|-----------|---------------------------------------|-------------|
| `pentad`  | Pentad code in the format `xxxx_yyyy` | `3400_2300` |

**Successful response**

Returns JSON containing the pentad, reporting year, date range, number of cards, ranked species data (name, number of cards and fraction of cards), and a flag (`fallback`) indicating whether previous-year data was used.

**Error responses**

- `400 Bad Request` — Invalid pentad code.
- `502 Bad Gateway` — SABAP2 request failure or invalid JSON response.
- `504 Gateway Timeout` — SABAP2 request timeout.

Successful responses are cached for a day to reduce repeated requests to SABAP2.


## Limitations

- Checklist accuracy depends on the availability and quality of SABAP2 data for the selected pentad. The data is submitted by volunteers, so human error can creep in, and Tickbird is dependent on data being available. Pentads with few cards give rougher rankings.
- Live checklist retrieval requires an internet connection; previously cached data may remain available when a request fails.
- Location lookup covers southern Africa only.
- Checklist ticks are stored locally in the browser and are not synchronised across devices.

## Acknowledgements

This project uses data from the Southern African Bird Atlas Project 2 (SABAP2). Tickbird is an independent hobby project and is not affiliated with or endorsed by SABAP2.

If Tickbird adds to your birding enjoyment, the best way to say thanks is to [atlas a pentad yourself](https://sabap2.birdmap.africa/howto) or [support the SABAP2 project](https://sabap2.birdmap.africa/donations).

Mapping is provided using [Leaflet](https://leafletjs.com/) and [OpenStreetMap](https://www.openstreetmap.org/copyright).
