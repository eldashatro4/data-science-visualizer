# Touch the Data 🚇

Nine interactive labs for introductory data science, laid out like a ride along Chicago's Orange Line: one stop per topic, in the order an intro course teaches them. Students drag data and run experiments in the browser, then press **Check it in Python** to run the same algorithm in real Python (NumPy, through [Pyodide](https://pyodide.org)) on the exact data on screen and confirm the numbers match.

**Live site:** https://eldashatro4.github.io/data-science-visualizer/

## The labs

| Stop | Lab | What students explore | Python function |
|---|---|---|---|
| 1. Midway | Sampling | The central limit theorem: sample means turn bell-shaped, with spread σ/√n | `clt_summary` |
| 2. Pulaski | Summary statistics | Mean vs. median, SD vs. IQR, box plots, and 1.5 × IQR outliers | `describe` |
| 3. Kedzie | Group by | Filter, group, and aggregate (split-apply-combine), with the equivalent Polars code | `group_aggregate` |
| 4. Western | Regression | Least squares, residuals, R², guessing a line by eye, and gradient descent with different learning rates | `fit_line`, `gradient_descent` |
| 5. 35th/Archer | Overfitting | Polynomial degree vs. train and test error, and the bias-variance tradeoff | `poly_fit` |
| 6. Ashland | Classification | k-nearest neighbors, decision regions, train/test split, confusion matrix, precision and recall | `knn_predict`, `classification_report` |
| 7. Halsted | Clustering | K-means step by step, k-means++ vs. random starting points, sum of squares | `kmeans` |
| 8. Roosevelt | A/B testing | Two-proportion z-test, confidence intervals, statistical power, and false positives | `ab_test`, `simulate_power` |
| 9. Library | Networks | Degree, shortest paths (BFS), and PageRank by power iteration | `pagerank`, `shortest_path_lengths` |

## Real Chicago data

The group-by, summary statistics and regression labs use **real CTA 'L' ridership** from the [City of Chicago Data Portal](https://data.cityofchicago.org):

- [CTA - Ridership - 'L' Station Entries - Daily Totals](https://data.cityofchicago.org/Transportation/CTA-Ridership-L-Station-Entries-Daily-Totals/5neh-572f) (daily entries for every station since 2001)
- [CTA - System Information - List of 'L' Stops](https://data.cityofchicago.org/Transportation/CTA-System-Information-List-of-L-Stops/8pix-ypme) (which lines serve each station)

`scripts/fetch_cta_data.py` asks the portal's API to average one year of daily entries by station and day type (weekday, Saturday, Sunday/holiday), joins the line colors, and saves a small `data/cta.json` (about 140 stations). The labs load that file. Without it, they fall back to practice data.

```bash
pip install requests
python scripts/fetch_cta_data.py            # 2025 by default; use --year 2024 for another year
git add data/ && git commit -m "Add CTA ridership data" && git push
```

## How it is built

```
index.html            page structure and the Orange Line route map
css/styles.css        design: light/dark themes, responsive, accessible
js/core.js            shared plotting, routing, and the in-browser Python runner
js/labs/*.js          one file per lab (interactive canvas plots)
python/labs.py        NumPy reference implementations of every algorithm
scripts/fetch_cta_data.py   downloads and summarizes real CTA ridership
data/cta.json         the real data the labs load (created by the script)
tests/test_labs.py    pytest checks against pandas, scikit-learn, SciPy and networkx
```

- **JavaScript** draws every plot instantly and responds to dragging, clicking and sliders.
- **Python** (`labs.py`) is the reference implementation. When a student presses *Check it in Python*, the page loads Pyodide, runs `labs.py` on the current data, shows the exact code it ran, and compares the result with the plot.
- **Tests** (16 in total, including the data script) confirm that `labs.py` matches the standard libraries: `LinearRegression`, `KMeans`, `KNeighborsClassifier`, pandas `groupby` and `describe`, SciPy's chi-square test, and networkx's `pagerank`.
- No build step and no backend. It is a static site, so it is free to host on GitHub Pages.

## Run locally

```bash
python -m http.server        # then open http://localhost:8000
```

The Python check needs the page to be served over http, which is why you start this server instead of opening the file directly.

## Tests

```bash
pip install -r requirements.txt
pytest                       # 16 tests
python python/labs.py        # quick demo
```

## Deploy

Push the repo to GitHub, go to **Settings → Pages**, and choose the `main` branch with the `/ (root)` folder.

## Accessibility

Keyboard-reachable controls with visible focus, respects reduced-motion settings, light theme by default with a dark-theme button, readable type (Atkinson Hyperlegible), and works with touch on phones.
