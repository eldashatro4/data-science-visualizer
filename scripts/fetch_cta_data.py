"""Download real CTA 'L' ridership from the Chicago Data Portal and save a small JSON file for the labs.

Usage:
    python scripts/fetch_cta_data.py              # 2025 (default)
    python scripts/fetch_cta_data.py --year 2024

Writes data/cta_<year>.json plus data/cta.json (the copy the site loads), about 30 KB each.
Commit them so the site works without calling the API.

Sources (City of Chicago Data Portal, public domain):
  - CTA - Ridership - 'L' Station Entries - Daily Totals   (5neh-572f)
  - CTA - System Information - List of 'L' Stops          (8pix-ypme)
The portal does the averaging for us (SoQL group-by), so we download hundreds of rows, not millions.
"""
import argparse
import json
from datetime import date
from pathlib import Path

import requests

PORTAL = "https://data.cityofchicago.org/resource"
RIDERSHIP_ID = "5neh-572f"
STOPS_ID = "8pix-ypme"
OUT_DIR = Path(__file__).resolve().parent.parent / "data"

# columns in the stops dataset that flag which lines serve a stop
LINE_FLAGS = {"red": "Red", "blue": "Blue", "g": "Green", "brn": "Brown", "p": "Purple",
              "pexp": "Purple", "y": "Yellow", "pnk": "Pink", "o": "Orange"}
DAYTYPES = {"W": "weekday", "A": "saturday", "U": "sunday"}   # U = Sunday/Holiday


def get(dataset, params):
    resp = requests.get(f"{PORTAL}/{dataset}.json", params=params, timeout=60)
    resp.raise_for_status()
    return resp.json()


def truthy(v):
    return v is True or str(v).lower() == "true"


def lines_by_station(stop_rows):
    """map_id (parent station id) -> sorted list of line names."""
    lines = {}
    for row in stop_rows:
        sid = int(row["map_id"])
        lines.setdefault(sid, set()).update(name for col, name in LINE_FLAGS.items() if truthy(row.get(col)))
    return {sid: sorted(ls) for sid, ls in lines.items()}


def build(ridership_rows, station_lines, year):
    """Combine per-daytype averages into one record per station (values in thousands of entries per day)."""
    stations = {}
    for row in ridership_rows:
        sid = int(row["station_id"])
        rec = stations.setdefault(sid, {"id": sid, "name": row["stationname"], "lines": station_lines.get(sid, [])})
        day = DAYTYPES.get(row["daytype"])
        if day:
            rec[day] = round(float(row["avg_rides"]) / 1000, 3)
            rec[day + "_days"] = int(row["days"])
    complete = [s for s in stations.values() if s["lines"] and all(d in s for d in DAYTYPES.values())]
    complete.sort(key=lambda s: -s["weekday"])
    return {
        "year": year,
        "units": "average station entries per day, in thousands",
        "source": "City of Chicago Data Portal: CTA - Ridership - 'L' Station Entries - Daily Totals (5neh-572f) "
                  "and CTA - System Information - List of 'L' Stops (8pix-ypme)",
        "downloaded": date.today().isoformat(),
        "stations": complete,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=2025)
    year = parser.parse_args().year

    print("Downloading the list of 'L' stops…")
    stops = get(STOPS_ID, {"$limit": 5000})
    station_lines = lines_by_station(stops)

    print(f"Averaging {year} daily entries by station and day type on the portal…")
    rides = get(RIDERSHIP_ID, {
        "$select": "station_id, stationname, daytype, avg(rides) AS avg_rides, count(*) AS days",
        "$where": f"date between '{year}-01-01T00:00:00' and '{year}-12-31T23:59:59'",
        "$group": "station_id, stationname, daytype",
        "$limit": 5000,
    })
    if not rides:
        raise SystemExit(f"No ridership rows for {year}. Try an earlier year with --year.")

    data = build(rides, station_lines, year)
    OUT_DIR.mkdir(exist_ok=True)
    out = OUT_DIR / f"cta_{year}.json"
    out.write_text(json.dumps(data, indent=1))
    (OUT_DIR / "cta.json").write_text(json.dumps(data, indent=1))   # the file the labs load
    busiest = data["stations"][0]
    print(f"Saved {len(data['stations'])} stations to {out.relative_to(OUT_DIR.parent)} "
          f"(busiest weekday station: {busiest['name']}, {busiest['weekday']:.1f}k entries/day)")


if __name__ == "__main__":
    main()
