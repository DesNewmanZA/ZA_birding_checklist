(() => {
  const $ = (id) => document.getElementById(id);
  const store = {
    get(k, d = null) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pct = (p) => Math.max(1, Math.round(p * 100));

  let data = null, seen = new Set(), view = "all", query = "";
  const seenKey = () => `bc:seen:${data.pentad}:${data.year}`;

  // SABAP2 pentads are 5' x 5' squares named by their north-west corner, e.g. 3400_2300.
  function toPentad(lat, lon) {
    const part = (v) => {
      const m = Math.floor(Math.abs(v) * 60);
      const m5 = m - (m % 5);
      return String(Math.floor(m5 / 60) * 100 + (m5 % 60)).padStart(4, "0");
    };
    return `${part(lat)}_${part(lon)}`;
  }


  // A pentad is the 5' x 5' square whose north-west corner is given by its code.
  function pentadBounds(p) {
    const [a, b] = p.split("_").map(Number);
    const deg = (c) => Math.floor(c / 100) + (c % 100) / 60;
    const north = -deg(a), west = deg(b), step = 5 / 60;
    return [[north - step, west], [north, west + step]];
  }

  let map = null, layer = null;
  function drawMap() {
    const panel = $("map-panel");
    panel.hidden = typeof L === "undefined";  // map library didn't load (e.g. offline)
    if (panel.hidden) return;
    if (!map) {
      map = L.map("map", { scrollWheelZoom: false, dragging: !L.Browser.mobile });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 17, attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      layer = L.layerGroup().addTo(map);
    }
    layer.clearLayers();
    map.invalidateSize();
    const bounds = pentadBounds(data.pentad);
    L.rectangle(bounds, { color: "#1e7a46", weight: 2, fillOpacity: 0.15 }).addTo(layer);
    const loc = store.get("bc:loc");
    const here = loc && loc.pentad === data.pentad;
    if (here) L.circleMarker([loc.lat, loc.lon], { radius: 8, color: "#fff", weight: 3, fillColor: "#1a6fd4", fillOpacity: 1 }).addTo(layer);
    map.fitBounds(bounds, { padding: [20, 20] });
    $("map-note").textContent = here
      ? `The green square is pentad ${data.pentad}. The blue dot is your location.`
      : `The green square is pentad ${data.pentad}.`;
  }

  function setMsg(text, isErr = false) {
    const el = $("msg");
    el.textContent = text;
    el.className = "msg" + (isErr ? " err" : "");
  }
  function showWelcome() { $("welcome").hidden = false; $("app").hidden = true; window.scrollTo(0, 0); }

  async function load(pentad) {
    setMsg("Loading this year's records…");
    $("btn-locate").disabled = true;
    try {
      const resp = await fetch(`/api/checklist?pentad=${pentad}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Request failed.");
      store.set(`bc:data:${pentad}`, { data: json, saved: Date.now() });
      store.set("bc:last", pentad);
      setMsg("");
      show(json);
    } catch (e) {
      const cached = store.get(`bc:data:${pentad}`);
      if (cached) show(cached.data);
      else setMsg(e.message + " Check your connection and try again.", true);
    } finally {
      $("btn-locate").disabled = false;
    }
  }

  function locate() {
    if (!navigator.geolocation) return setMsg("This browser can't share your location. Enter a pentad instead.", true);
    setMsg("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const { latitude: lat, longitude: lon } = coords;
        if (lat > 0 || lat < -36 || lon < 8 || lon > 42)
          return setMsg("You appear to be outside southern Africa, where SABAP2 has coverage. Enter a pentad instead.", true);
        const pentad = toPentad(lat, lon);
        store.set("bc:loc", { lat, lon, pentad });
        load(pentad);
      },
      (err) => setMsg(err.code === 1
        ? "Location access is blocked. Allow it in your browser settings, or enter a pentad instead."
        : "Couldn't get your location. Try again or enter a pentad.", true),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 }
    );
  }

  function show(d) {
    data = d;
    seen = new Set(store.get(seenKey(), []));
    d.species.forEach((s, i) => (s.rank = i + 1));
    $("welcome").hidden = true;
    $("app").hidden = false;
    $("where").textContent = `Pentad ${d.pentad} · ${d.year}`;
    render();
    drawMap();
    window.scrollTo(0, 0);
  }

  function render() {
    const sp = data.species, total = sp.length, n = seen.size;
    const p = total ? Math.round((n / total) * 100) : 0;
    $("seen-count").textContent = n;
    $("total-count").textContent = `/ ${total}`;
    $("seen-pct").textContent = `${p}%`;
    $("bar-fill").style.width = `${p}%`;

    const tiers = [["Common", "50%+", (s) => s.pct >= 0.5], ["Regular", "10–50%", (s) => s.pct >= 0.1 && s.pct < 0.5], ["Scarce", "under 10%", (s) => s.pct < 0.1]];
    $("tiers").innerHTML = tiers.map(([label, range, test]) => {
      const group = sp.filter(test);
      return `<div><dt>${label} (${range})</dt><dd>${group.filter((s) => seen.has(s.name)).length}/${group.length}</dd></div>`;
    }).join("");

    const next = sp.filter((s) => !seen.has(s.name)).slice(0, 5);
    $("next").innerHTML = next.length
      ? next.map((s) => `<li>${esc(s.name)} <span>${pct(s.pct)}% of cards</span></li>`).join("")
      : "<li>You've ticked everything. Nice work!</li>";
    $("meta").textContent = `Based on ${data.cards} full-protocol atlas cards, ${data.start} to ${data.end}. Percentages show how many cards each bird appeared on.`;

    const q = query.trim().toLowerCase();
    const rows = sp.filter((s) => (view === "all" || (view === "seen") === seen.has(s.name)) && (!q || s.name.toLowerCase().includes(q)));
    $("list").innerHTML = rows.length ? rows.map((s) => {
      const on = seen.has(s.name);
      return `<li><label class="row${on ? " on" : ""}"><input type="checkbox" data-name="${esc(s.name)}"${on ? " checked" : ""}>` +
        `<span class="box" aria-hidden="true"></span><span class="nm"><b>${esc(s.name)}</b><small>#${s.rank} · ${pct(s.pct)}%</small></span>` +
        `<span class="meter" aria-hidden="true"><i style="width:${pct(s.pct)}%"></i></span></label></li>`;
    }).join("") : `<li class="empty">${total ? "No birds match." : "No full-protocol cards for this pentad yet this year."}</li>`;
  }

  $("list").addEventListener("change", (e) => {
    const name = e.target.dataset.name;
    if (!name) return;
    e.target.checked ? seen.add(name) : seen.delete(name);
    store.set(seenKey(), [...seen]);
    if (navigator.vibrate) navigator.vibrate(8);
    render();
  });
  document.querySelector(".tabs").addEventListener("click", (e) => {
    const v = e.target.dataset.view;
    if (!v) return;
    view = v;
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b === e.target));
    render();
  });
  $("search").addEventListener("input", (e) => { query = e.target.value; render(); });
  $("btn-locate").addEventListener("click", locate);
  $("btn-change").addEventListener("click", showWelcome);
  $("btn-reset").addEventListener("click", () => {
    if (!confirm("Clear all ticks for this pentad?")) return;
    seen.clear(); store.set(seenKey(), []); render();
  });
  $("pentad-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("pentad-input").value.trim();
    if (/^\d{4}_\d{4}$/.test(v)) store.set("bc:loc", null);
    /^\d{4}_\d{4}$/.test(v) ? load(v) : setMsg("Enter a pentad like 3400_2300.", true);
  });

  // Reopen the last pentad instantly (works offline), refreshing if the data is over 12 hours old.
  const last = store.get("bc:last");
  const cached = last && store.get(`bc:data:${last}`);
  if (cached) {
    show(cached.data);
    if (Date.now() - cached.saved > 432e5 || cached.data.year !== new Date().getFullYear()) load(last);
  }
})();
