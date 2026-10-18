(() => {
  /* SMALL HELPERS */

  const $ = (id) => document.getElementById(id);

  const store = {
    get(key, fallback = null) {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
      }
    },
  };

  const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (text) => text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

  const pct = (fraction) => Math.max(1, Math.round(fraction * 100));

  const inRegion = (lat, lon) => lat <= 0 && lat >= -36 && lon >= 8 && lon <= 42;


  /* APP STATE (values that change while the app is used) */

  let data = null;
  let seen = new Set();
  let view = "all";
  let query = "";

  const seenKey = () => `bc:seen:${data.pentad}:${data.year}`;

  /* PENTAD MATHS */

  // Converts a latitude/longitude to a pentad code such as "3400_2300"
  function toPentad(lat, lon) {
    const part = (value) => {
      const totalMinutes = Math.floor(Math.abs(value) * 60);
      const roundedDown = totalMinutes - (totalMinutes % 5);
      const degrees = Math.floor(roundedDown / 60);
      const minutes = roundedDown % 60;
      return String(degrees * 100 + minutes).padStart(4, "0");
    };
    return `${part(lat)}_${part(lon)}`;
  }

  // Converts a pentad code back into the corner points of its square, for drawing on a map
  function pentadBounds(pentad) {
    const [latCode, lonCode] = pentad.split("_").map(Number);
    const toDegrees = (code) => Math.floor(code / 100) + (code % 100) / 60;
    const north = -toDegrees(latCode);
    const west = toDegrees(lonCode);
    const size = 5 / 60;
    return [[north - size, west], [north, west + size]];
  }

  /* RESULTS MAP (shown above the checklist) */

  let map = null;
  let layer = null;

  function drawMap() {
    // If the Leaflet library didn't load (e.g. offline), hide the map panel
    const panel = $("map-panel");
    panel.hidden = typeof L === "undefined";
    if (panel.hidden) return;

    // Create the map once. On phones, one-finger dragging is switched off so the
    // map doesn't hijack page scrolling.
    if (!map) {
      map = L.map("map", { scrollWheelZoom: false, dragging: !L.Browser.mobile });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 17,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      layer = L.layerGroup().addTo(map);
    }

    layer.clearLayers();
    map.invalidateSize();

    // Green square = the pentad
    const bounds = pentadBounds(data.pentad);
    L.rectangle(bounds, { color: "#1e7a46", weight: 2, fillOpacity: 0.15 }).addTo(layer);

    // Blue dot = the user's GPS point or the point they tapped (only if it's inside this pentad)
    const loc = store.get("bc:loc");
    const showDot = loc && loc.pentad === data.pentad;
    if (showDot) {
      L.circleMarker([loc.lat, loc.lon], {
        radius: 8, color: "#fff", weight: 3, fillColor: "#1a6fd4", fillOpacity: 1,
      }).addTo(layer);
    }

    map.fitBounds(bounds, { padding: [20, 20] });

    const dotMeaning = loc && loc.picked ? "the point you chose" : "your location";
    $("map-note").textContent = showDot
      ? `The green square is pentad ${data.pentad}. The blue dot is ${dotMeaning}.`
      : `The green square is pentad ${data.pentad}.`;
  }


  /* SCREEN SWITCHING AND MESSAGES */

  // Shows a message under the pentad options. Pass true as the second value for an error (red).
  function setMsg(text, isError = false) {
    const el = $("msg");
    el.textContent = text;
    el.className = "msg" + (isError ? " err" : "");
  }

  // Goes back to the landing page ("Change location")
  function showWelcome() {
    $("welcome").hidden = false;
    $("app").hidden = true;

    // Collapse all three pentad options
    document.querySelectorAll(".method").forEach((option) => { option.open = false; });

    // Reset the subtitle under the title
    $("where").textContent =
      `Birds recorded in your area in ${new Date().getFullYear()}, ranked from most to least common.`;

    if (pickMap) pickMap.invalidateSize();
    window.scrollTo(0, 0);
  }

  // Switches to the checklist screen and draws everything for a pentad
  function show(newData) {
    data = newData;
    seen = new Set(store.get(seenKey(), []));
    data.species.forEach((s, i) => { s.rank = i + 1; });

    $("welcome").hidden = true;
    $("app").hidden = false;
    $("where").textContent = `Pentad ${data.pentad} · ${data.year}`;

    render();
    drawMap();
    window.scrollTo(0, 0);
  }


  /* GETTING DATA FROM THE SERVER */

  // Asks our Flask server for the bird list for a pentad, then shows it
  async function load(pentad) {
    setMsg("Loading this year's records…");
    $("btn-locate").disabled = true;

    try {
      const response = await fetch(`/api/checklist?pentad=${pentad}`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Request failed.");

      // Keep a copy in case the connection fails next time
      store.set(`bc:data:${pentad}`, { data: json, saved: Date.now() });
      setMsg("");
      show(json);

    } catch (error) {
      // Request failed: use the saved copy for this pentad if we have one (helps with patchy signal)
      const cached = store.get(`bc:data:${pentad}`);
      if (cached) show(cached.data);
      else setMsg(error.message + " Check your connection and try again.", true);

    } finally {
      $("btn-locate").disabled = false;
    }
  }

  // "Use my location": asks the browser for GPS, works out the pentad, then loads it
  function locate() {
    if (!navigator.geolocation) {
      return setMsg("This browser can't share your location. Enter a pentad instead.", true);
    }
    setMsg("Finding your location…");

    navigator.geolocation.getCurrentPosition(
      // Success
      ({ coords }) => {
        const { latitude: lat, longitude: lon } = coords;
        if (!inRegion(lat, lon)) {
          return setMsg("You appear to be outside southern Africa, where SABAP2 has coverage. Enter a pentad instead.", true);
        }
        const pentad = toPentad(lat, lon);
        store.set("bc:loc", { lat, lon, pentad });   // remembered so the map can show a blue dot
        load(pentad);
      },
      // Failure (error code 1 means the user said no)
      (error) => {
        setMsg(
          error.code === 1
            ? "Location access is blocked. Allow it in your browser settings, or enter a pentad instead."
            : "Couldn't get your location. Try again or enter a pentad.",
          true
        );
      },
      // Options: a rough position is fine, give up after 15 seconds, accept a position up to 10 minutes old
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }
    );
  }


  /* DRAWING THE CHECKLIST SCREEN */

  function render() {
    renderScoreBar();
    renderInsights();
    renderList();
  }

  // The sticky bar at the top: "12 / 187", percentage and progress bar
  function renderScoreBar() {
    const total = data.species.length;
    const percent = total ? Math.round((seen.size / total) * 100) : 0;

    $("seen-count").textContent = seen.size;
    $("total-count").textContent = `/ ${total}`;
    $("seen-pct").textContent = `${percent}%`;
    $("bar-fill").style.width = `${percent}%`;
  }

  // The "How you're doing" panel: commonness groups, best bets and the data footnote
  function renderInsights() {
    const species = data.species;

    // Groups of birds by how often they're recorded. Each has a label, a range description
    // and a test that says which birds belong to it.
    const tiers = [
      { label: "Common",  range: "50%+",      test: (s) => s.pct >= 0.5 },
      { label: "Regular", range: "10–50%",    test: (s) => s.pct >= 0.1 && s.pct < 0.5 },
      { label: "Scarce",  range: "under 10%", test: (s) => s.pct < 0.1 },
    ];
    $("tiers").innerHTML = tiers.map(({ label, range, test }) => {
      const group = species.filter(test);
      const seenInGroup = group.filter((s) => seen.has(s.name)).length;
      return `<div><dt>${label} (${range})</dt><dd>${seenInGroup}/${group.length}</dd></div>`;
    }).join("");

    // "Best bets": the 5 most commonly recorded birds not yet ticked
    const nextFive = species.filter((s) => !seen.has(s.name)).slice(0, 5);
    $("next").innerHTML = nextFive.length
      ? nextFive.map((s) => `<li>${esc(s.name)} <span>${pct(s.pct)}% of submissions</span></li>`).join("")
      : "<li>You've ticked everything. Nice work!</li>";

    // Footnote. If this year had no data, the server sent last year's and we say so.
    const fallbackNote = data.fallback
      ? `Too few submissions for ${new Date().getFullYear()} so far, so this uses ${data.year}'s data. `
      : "";
    $("meta").textContent = fallbackNote +
      `Based on ${data.cards} SABAP2 submissions, ${data.start} to ${data.end}. ` +
      "Percentages show how many submissions each bird was recorded on.";
  }

  // The list of birds, filtered by the current tab and search text
  function renderList() {
    const search = query.trim().toLowerCase();

    const rows = data.species.filter((s) => {
      const isSeen = seen.has(s.name);
      const matchesTab = view === "all" || (view === "seen") === isSeen;
      const matchesSearch = !search || s.name.toLowerCase().includes(search);
      return matchesTab && matchesSearch;
    });

    if (!rows.length) {
      const message = data.species.length
        ? "No birds match."
        : "No SABAP2 submissions found for this pentad this year or last.";
      $("list").innerHTML = `<li class="empty">${message}</li>`;
      return;
    }

    // One checkbox row per bird: tick box, name with rank and percentage, and a small bar
    $("list").innerHTML = rows.map((s) => {
      const isSeen = seen.has(s.name);
      return `
        <li>
          <label class="row${isSeen ? " on" : ""}">
            <input type="checkbox" data-name="${esc(s.name)}"${isSeen ? " checked" : ""}>
            <span class="box" aria-hidden="true"></span>
            <span class="nm">
              <b>${esc(s.name)}</b>
              <small>#${s.rank} · Recorded on ${pct(s.pct)}% of submissions</small>
            </span>
            <span class="meter" aria-hidden="true"><i style="width:${pct(s.pct)}%"></i></span>
          </label>
        </li>`;
    }).join("");
  }


  /* LANDING PAGE MAP PICKER ("Pick a point on the map") */

  let pickMap = null;     // the Leaflet map on the landing page
  let pickLayer = null;   // holds the square and dot for the chosen point
  let picked = null;      // the chosen point: { lat, lon, pentad }, or null if none

  // Builds the map the first time the "Pick a point" panel is opened
  function initPickMap() {
    // If the map library didn't load, hide this option entirely
    if (typeof L === "undefined") {
      $("pick-details").hidden = true;
      return;
    }

    if (!pickMap) {
      pickMap = L.map("pick-map", { scrollWheelZoom: false }).setView([-29, 24.5], 5);  // starts zoomed out on South Africa
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 17,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(pickMap);
      pickLayer = L.layerGroup().addTo(pickMap);

      // When the user taps the map...
      pickMap.on("click", (event) => {
        const { lat, lng } = event.latlng;
        pickLayer.clearLayers();

        // ...outside southern Africa: explain and disable the button
        if (!inRegion(lat, lng)) {
          picked = null;
          $("btn-pick-go").disabled = true;
          $("btn-pick-go").textContent = "Use this pentad";
          $("pick-note").textContent = "That point is outside southern Africa, where SABAP2 has coverage. Try another spot.";
          return;
        }

        // ...inside the region: work out the pentad, draw it and enable the button
        const pentad = toPentad(lat, lng);
        picked = { lat, lon: lng, pentad };

        L.rectangle(pentadBounds(pentad), { color: "#1e7a46", weight: 2, fillOpacity: 0.15 }).addTo(pickLayer);
        L.circleMarker([lat, lng], {
          radius: 8, color: "#fff", weight: 3, fillColor: "#1a6fd4", fillOpacity: 1,
        }).addTo(pickLayer);

        $("pick-note").textContent = `Pentad ${pentad}. Tap elsewhere to change it.`;
        $("btn-pick-go").disabled = false;
        $("btn-pick-go").textContent = `Use pentad ${pentad}`;
      });
    }

    // The map was hidden inside a closed panel, so tell it to re-measure itself
    pickMap.invalidateSize();
  }


  /* BUTTONS AND INPUTS */

  // Ticking or un-ticking a bird
  $("list").addEventListener("change", (event) => {
    const name = event.target.dataset.name;
    if (!name) return;

    if (event.target.checked) seen.add(name);
    else seen.delete(name);

    store.set(seenKey(), [...seen]);                        // save ticks
    if (navigator.vibrate) navigator.vibrate(8);            // tiny buzz on Android phones
    render();
  });

  // The All / Not yet seen / Seen tabs
  document.querySelector(".tabs").addEventListener("click", (event) => {
    const chosenView = event.target.dataset.view;
    if (!chosenView) return;

    view = chosenView;
    document.querySelectorAll(".tabs button").forEach((button) => {
      button.classList.toggle("on", button === event.target);   // highlight the active tab
      button.setAttribute("aria-pressed", button === event.target);
    });
    render();
  });

  // Typing in the search box
  $("search").addEventListener("input", (event) => {
    query = event.target.value;
    render();
  });

  // "Find my pentad" (GPS)
  $("btn-locate").addEventListener("click", locate);

  // "Change location" and "Clear ticks"
  $("btn-change").addEventListener("click", showWelcome);
  $("btn-reset").addEventListener("click", () => {
    if (!confirm("Clear all ticks for this pentad?")) return;
    seen.clear();
    store.set(seenKey(), []);
    render();
  });

  // Typing a pentad code and pressing Load
  $("pentad-form").addEventListener("submit", (event) => {
    event.preventDefault();                                  // stop the browser reloading the page
    const code = $("pentad-input").value.trim();

    if (/^\d{4}_\d{4}$/.test(code)) {                        // must look like 3400_2300
      store.set("bc:loc", null);                             // a typed code has no GPS dot
      load(code);
    } else {
      setMsg("Enter a pentad like 3400_2300.", true);
    }
  });

  // Opening the map option builds the map; "Use this pentad" loads the tapped point
  $("pick-details").addEventListener("toggle", (event) => {
    if (event.target.open) initPickMap();
  });
  $("btn-pick-go").addEventListener("click", () => {
    if (!picked) return;
    store.set("bc:loc", { ...picked, picked: true });
    load(picked.pentad);
  });

  // Only one of the three pentad options can be open at a time
  document.querySelectorAll(".method").forEach((option) => {
    option.addEventListener("toggle", () => {
      if (!option.open) return;
      document.querySelectorAll(".method").forEach((other) => {
        if (other !== option) other.open = false;
      });
    });
  });

})();