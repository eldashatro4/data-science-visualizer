"""Check the CTA download script's data shaping with small fake API responses (no network needed)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import fetch_cta_data as f  # noqa: E402


def test_lines_by_station_merges_platforms_and_flags():
    stops = [
        {"map_id": "40380", "blue": True, "red": False},
        {"map_id": "40380", "brn": "true", "g": True, "o": True, "pnk": True, "p": True},
        {"map_id": "41320", "red": True, "brn": True, "pexp": True},
    ]
    lines = f.lines_by_station(stops)
    assert lines[40380] == ["Blue", "Brown", "Green", "Orange", "Pink", "Purple"]
    assert lines[41320] == ["Brown", "Purple", "Red"]


def test_build_keeps_complete_stations_in_thousands():
    rides = [
        {"station_id": "40380", "stationname": "Clark/Lake", "daytype": "W", "avg_rides": "12345.6", "days": "250"},
        {"station_id": "40380", "stationname": "Clark/Lake", "daytype": "A", "avg_rides": "4000", "days": "52"},
        {"station_id": "40380", "stationname": "Clark/Lake", "daytype": "U", "avg_rides": "3000", "days": "63"},
        {"station_id": "99999", "stationname": "Half data", "daytype": "W", "avg_rides": "100", "days": "250"},
    ]
    out = f.build(rides, {40380: ["Blue"], 99999: ["Red"]}, 2025)
    assert [s["name"] for s in out["stations"]] == ["Clark/Lake"]
    s = out["stations"][0]
    assert (s["weekday"], s["saturday"], s["sunday"]) == (12.346, 4.0, 3.0)
