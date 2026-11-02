"""Check labs.py against scikit-learn and SciPy.  Run:  pytest"""
import sys
from pathlib import Path

import numpy as np
import pytest
from scipy import stats
from sklearn.cluster import KMeans
from sklearn.linear_model import LinearRegression

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "python"))
import labs  # noqa: E402

rng = np.random.default_rng(42)


def test_fit_line_matches_sklearn():
    x = rng.uniform(0, 10, 50)
    y = 1.5 - 0.7 * x + rng.normal(0, 1, 50)
    ours = labs.fit_line(x, y)
    ref = LinearRegression().fit(x.reshape(-1, 1), y)
    assert ours["slope"] == pytest.approx(ref.coef_[0])
    assert ours["intercept"] == pytest.approx(ref.intercept_)
    assert ours["r2"] == pytest.approx(ref.score(x.reshape(-1, 1), y))
    assert ours["r"] == pytest.approx(stats.pearsonr(x, y)[0])


def test_fit_line_needs_two_distinct_x():
    with pytest.raises(ValueError):
        labs.fit_line([1, 1], [2, 3])


def test_kmeans_matches_sklearn_from_same_start():
    pts = np.vstack([rng.normal(c, 0.5, (40, 2)) for c in [(2, 2), (8, 2), (5, 8)]])
    start = pts[[0, 40, 80]]
    ours = labs.kmeans(pts, 3, init=start.copy())
    ref = KMeans(3, init=start, n_init=1).fit(pts)
    assert ours["inertia"] == pytest.approx(ref.inertia_)
    assert sorted(map(tuple, np.round(ours["centroids"], 6))) == sorted(map(tuple, np.round(ref.cluster_centers_, 6)))


def test_kmeans_inertia_never_increases():
    pts = rng.uniform(0, 10, (200, 2))
    hist = labs.kmeans(pts, 5, seed=3)["history"]
    assert all(b <= a + 1e-9 for a, b in zip(hist, hist[1:]))


def test_ab_test_matches_scipy_z_test():
    res = labs.ab_test(100, 1000, 130, 1000)
    table = np.array([[100, 900], [130, 870]])
    chi2, p, _, _ = stats.chi2_contingency(table, correction=False)  # equals the pooled z-test squared
    assert res["z"] ** 2 == pytest.approx(chi2)
    assert res["p_value"] == pytest.approx(p)


def test_false_positive_rate_is_about_alpha():
    assert labs.simulate_power(0.2, 0.2, 2000, runs=3000, seed=7) == pytest.approx(0.05, abs=0.015)


# ---------------- new labs ----------------
import networkx as nx  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.linear_model import LinearRegression as LR  # noqa: E402
from sklearn.neighbors import KNeighborsClassifier  # noqa: E402
from sklearn.preprocessing import PolynomialFeatures  # noqa: E402


def test_clt_predicted_se_matches_simulation():
    pop = rng.exponential(2, 5000)
    means = [rng.choice(pop, 30).mean() for _ in range(4000)]
    out = labs.clt_summary(pop, means, 30)
    assert out["observed_se"] == pytest.approx(out["predicted_se"], rel=0.05)


def test_describe_matches_pandas():
    v = rng.normal(50, 10, 41).tolist() + [120.0]
    d = labs.describe(v)
    s = pd.Series(v)
    assert d["mean"] == pytest.approx(s.mean())
    assert d["sd"] == pytest.approx(s.std())
    assert d["q1"] == pytest.approx(s.quantile(0.25)) and d["q3"] == pytest.approx(s.quantile(0.75))
    assert 120.0 in d["outliers"]


def test_group_aggregate_matches_pandas():
    rows = [{"line": rng.choice(["Red", "Blue", "Orange"]), "riders": int(rng.integers(100, 900)),
             "weekend": bool(rng.integers(0, 2))} for _ in range(60)]
    df = pd.DataFrame(rows)
    for agg in ["mean", "sum", "count", "max", "median"]:
        ours = labs.group_aggregate(rows, "line", "riders", agg)
        ref = df.groupby("line")["riders"].agg(agg).to_dict()
        assert ours == pytest.approx(ref)
    filtered = labs.group_aggregate(rows, "line", "riders", "mean", where=("riders", ">", 500))
    assert filtered == pytest.approx(df[df.riders > 500].groupby("line")["riders"].mean().to_dict())


def test_gradient_descent_converges_to_least_squares():
    x = rng.uniform(0, 10, 40); y = 3 - 0.4 * x + rng.normal(0, 0.5, 40)
    gd = labs.gradient_descent(x, y, learning_rate=0.02, steps=5000)
    ls = labs.fit_line(x, y)
    assert gd["slope"] == pytest.approx(ls["slope"], abs=1e-4)
    assert gd["intercept"] == pytest.approx(ls["intercept"], abs=1e-3)
    mses = [p[2] for p in gd["path"]]
    assert all(b <= a + 1e-12 for a, b in zip(mses, mses[1:]))


def test_poly_fit_matches_sklearn():
    x = rng.uniform(0, 10, 25); y = np.sin(x) * 3 + 5 + rng.normal(0, 0.4, 25)
    xt = rng.uniform(0, 10, 15); yt = np.sin(xt) * 3 + 5
    for deg in [1, 3, 6]:
        ours = labs.poly_fit(x, y, xt, yt, deg)
        f = PolynomialFeatures(deg)
        model = LR().fit(f.fit_transform(labs._scale(x).reshape(-1, 1)), y)
        pred = model.predict(f.transform(labs._scale(xt).reshape(-1, 1)))
        assert ours["test_mse"] == pytest.approx(np.mean((pred - yt) ** 2), rel=1e-6)


def test_knn_matches_sklearn():
    X = rng.uniform(0, 10, (60, 2)); y = (X[:, 0] + X[:, 1] + rng.normal(0, 1.5, 60) > 10).astype(int)
    Q = rng.uniform(0, 10, (40, 2))
    for k in [1, 3, 7]:
        assert labs.knn_predict(X, y, Q, k) == KNeighborsClassifier(k).fit(X, y).predict(Q).tolist()


def test_classification_report():
    r = labs.classification_report([1, 1, 0, 0, 1], [1, 0, 0, 1, 1])
    assert r["confusion"] == {"tp": 2, "fp": 1, "fn": 1, "tn": 1}
    assert r["accuracy"] == pytest.approx(0.6)


def test_pagerank_and_distances_match_networkx():
    edges = [(0, 1), (1, 2), (2, 0), (2, 3), (3, 4), (5, 4), (6, 2)]
    ours = labs.pagerank(8, edges)        # node 7 is isolated
    G = nx.Graph(); G.add_nodes_from(range(8)); G.add_edges_from(edges)
    ref = nx.pagerank(G, alpha=0.85, tol=1e-12, max_iter=500)
    assert ours["pagerank"] == pytest.approx([ref[i] for i in range(8)], abs=1e-6)
    d = labs.shortest_path_lengths(8, edges, 0)
    sp = nx.single_source_shortest_path_length(G, 0)
    assert d == [sp.get(i) for i in range(8)]
