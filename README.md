# ZA_birding_checklist - Tickbird
Tickbird is a small birding companion that builds custom bird checklists for Southern Africa using data from the Southern African Bird Atlas Project 2 (SABAP2). By combining atlas data with a user-selected pentad, Tickbird provides an up-to-date picture of which species have been recorded in a particular area, helping birders get a better idea of what they might encounter in the field.

Traditional birding apps often rely on static distribution maps; Tickbird uses recent observations submitted by birders to keep its checklists as current as possible. It retrieves full-protocol cards submitted to SABAP2 during the current calendar year, falling back to the previous year's data if no cards have been submitted for the current year.

The aim isn't to replace existing birding apps or checklists, but rather to complement them with a location-specific, data-driven tool. Whether you're exploring a new area, checking a sighting against local records while learning to identify birds, or turning a familiar patch into a birding challenge, Tickbird helps you discover what's been seen nearby and keep track of your own sightings.

Getting started is simple: select a pentad using your location, choose a spot on the map, or enter a pentad code manually. Tickbird retrieves the available full-protocol cards for that pentad and ranks recorded species from most to least frequently observed. You can then work through the checklist and tick off the birds you spot along the way.

Species are presented in order from most to least commonly seen and categorised by how frequently they appear in submitted cards:

- **Common**: recorded on more than 50% of cards.
- **Regular**: recorded on 10–50% of cards.
- **Rare**: recorded on less than 10% of cards.

Tickbird is designed to be simple and convenient for short birding outings. Your checklist progress is stored locally in your browser.


## Technology Stack

| Component                | Technology                                         |
|--------------------------|----------------------------------------------------|
| Backend                  | Python, Flask                                      |
| Frontend                 | JavaScript, HTML and CSS                           |
| Mapping                  | Leaflet                                            |
| Map tiles                | OpenStreetMap                                      |
| Data source              | SABAP2                                             |
| Local persistence        | Browser local storage                              |
| Deployment configuration | Flask static-file configuration adapted for Vercel |

## Project Structure

The following files and directories are relevant to the application.

```text
.
├── app.py                  # Flask application and API endpoint
├── app.js                  # Frontend checklist logic
├── python_functions.py     # SABAP2 data retrieval and date-range helpers
├── templates/
│   └── index.html          # Main application page
└── public/                 # Static assets served by Flask
```

## Running Locally

### Prerequisites

- Python 3
- The project dependencies, including Flask and Requests
- The remaining project files, including `python_functions.py`, the HTML template, and the required static assets

### Setup

1. Clone or download the repository.

2. Navigate to the project directory.

3. Install the required Python dependencies. If a `requirements.txt` file is provided, run:

   ```bash
   pip install -r requirements.txt
   ```

4. Start the Flask application:

   ```bash
   python app.py
   ```

5. Open the local address displayed by Flask in your browser.


## API

### `GET /api/checklist`

Retrieves the ranked species checklist for a specified pentad.

**Query parameter**

| Parameter | Description                           | Example     |
|-----------|---------------------------------------|-------------|
| `pentad`  | Pentad code in the format `xxxx_yyyy` | `3400_2300` |

**Successful response**

Returns JSON containing the pentad, reporting year, date range, number of full-protocol cards, ranked species data, and a flag indicating whether previous-year data was used.

**Error responses**

- `400 Bad Request` — Invalid pentad code.
- `502 Bad Gateway` — SABAP2 request failure or invalid JSON response.
- `504 Gateway Timeout` — SABAP2 request timeout.

Successful responses include cache headers to reduce repeated requests.


## Limitations

- Checklist accuracy depends on the availability and quality of SABAP2 data for the selected pentad. Full protocol submissions follow strict requirements and tend to be of high quality, but human error can still creep in, and Tickbird is dependent on data being available.
- Live checklist retrieval requires an internet connection; previously cached data may remain available when a request fails.
- Checklist ticks are stored locally in the browser and are not synchronised across devices.

## Acknowledgements

This project uses data from the Southern African Bird Atlas Project 2 (SABAP2). If Tickbird adds to your birding enjoyment, the best way to say thanks is to <a href="https://sabap2.birdmap.africa/howto" target="_blank" rel="noopener">atlas a pentad yourself</a> or <a href="https://sabap2.birdmap.africa/donations" target="_blank" rel="noopener">support the SABAP2  project</a>.</p>

Mapping is provided using Leaflet and OpenStreetMap.
