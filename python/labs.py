"""NumPy implementations of every Touch the Data lab.

The web page runs this exact file in the browser with Pyodide, so students can
check every number the interactive plots show against plain Python. Only NumPy
and the standard library are used, so it runs anywhere.
"""
from math import erf, sqrt

import numpy as np


# ---------------------------------------------------------------------------
# Linear regression (ordinary least squares)
# ---------------------------------------------------------------------------
def fit_line(x, y):
    """Fit y = a + b*x by least squares and return the fit statistics."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    if len(x) < 2 or np.allclose(x, x[0]):
        raise ValueError("need at least 2 points with different x values")
    x_mean, y_mean = x.mean(), y.mean()
    sxx = np.sum((x - x_mean) ** 2)
    sxy = np.sum((x - x_mean) * (y - y_mean))
    syy = np.sum((y - y_mean) ** 2)
    b = sxy / sxx
    a = y_mean - b * x_mean
    residuals = y - (a + b * x)
    sse = np.sum(residuals ** 2)
    return {
        "intercept": float(a),
        "slope": float(b),
        "r2": float(1 - sse / syy) if syy > 0 else 1.0,
        "mse": float(sse / len(x)),
        "r": float(sxy / sqrt(sxx * syy)) if syy > 0 else 0.0,
    }


# ---------------------------------------------------------------------------
# K-means clustering (Lloyd's algorithm)
# ---------------------------------------------------------------------------
def kmeans_plus_plus(points, k, rng):
    """Choose k starting centroids that are spread out (k-means++)."""
    points = np.asarray(points, float)
    centroids = [points[rng.integers(len(points))]]
    for _ in range(1, k):
        d2 = np.min(((points[:, None, :] - np.array(centroids)[None]) ** 2).sum(-1), axis=1)
        centroids.append(points[rng.choice(len(points), p=d2 / d2.sum())])
    return np.array(centroids)


def kmeans(points, k, init=None, max_iter=100, seed=None):
    """Run k-means. Pass `init` to start from specific centroids.

    Returns the final centroids, each point's cluster label, the within-cluster
    sum of squares (inertia) and the inertia after every iteration.
    """
    points = np.asarray(points, float)
    rng = np.random.default_rng(seed)
    centroids = np.asarray(init, float) if init is not None else kmeans_plus_plus(points, k, rng)
    labels = np.full(len(points), -1)
    history = []
    for _ in range(max_iter):
        # assign step: nearest centroid for every point
        dist = ((points[:, None, :] - centroids[None]) ** 2).sum(-1)
        new_labels = dist.argmin(axis=1)
        if np.array_equal(new_labels, labels):
            break
        labels = new_labels
        # move step: each centroid goes to the mean of its points
        for j in range(len(centroids)):
            members = points[labels == j]
            centroids[j] = members.mean(axis=0) if len(members) else points[rng.integers(len(points))]
        history.append(inertia(points, centroids, labels))
    return {
        "centroids": centroids.tolist(),
        "labels": labels.tolist(),
        "inertia": inertia(points, centroids, labels),
        "history": history,
        "iterations": len(history),
    }


def inertia(points, centroids, labels):
    points, centroids = np.asarray(points, float), np.asarray(centroids, float)
    return float(((points - centroids[np.asarray(labels)]) ** 2).sum())


# ---------------------------------------------------------------------------
# A/B testing (two-proportion z-test)
# ---------------------------------------------------------------------------
def normal_cdf(z):
    return 0.5 * (1 + erf(z / sqrt(2)))


def ab_test(conversions_a, n_a, conversions_b, n_b, alpha=0.05):
    """Two-sided two-proportion z-test with a 95% confidence interval for B - A."""
    rate_a, rate_b = conversions_a / n_a, conversions_b / n_b
    pooled = (conversions_a + conversions_b) / (n_a + n_b)
    se_pooled = sqrt(pooled * (1 - pooled) * (1 / n_a + 1 / n_b))
    z = (rate_b - rate_a) / se_pooled if se_pooled > 0 else 0.0
    p_value = 2 * (1 - normal_cdf(abs(z)))
    se = sqrt(rate_a * (1 - rate_a) / n_a + rate_b * (1 - rate_b) / n_b)
    diff = rate_b - rate_a
    return {
        "rate_a": rate_a,
        "rate_b": rate_b,
        "difference": diff,
        "ci_95": [diff - 1.96 * se, diff + 1.96 * se],
        "z": z,
        "p_value": p_value,
        "significant": p_value < alpha,
    }


def simulate_power(p_a, p_b, n, runs=1000, alpha=0.05, seed=None):
    """Share of simulated experiments that come out significant.

    This is statistical power when p_a != p_b, and the false positive rate when p_a == p_b.
    """
    rng = np.random.default_rng(seed)
    conv_a = rng.binomial(n, p_a, runs)
    conv_b = rng.binomial(n, p_b, runs)
    hits = sum(ab_test(a, n, b, n, alpha)["significant"] for a, b in zip(conv_a, conv_b))
    return hits / runs


# ---------------------------------------------------------------------------
# Sampling and the central limit theorem
# ---------------------------------------------------------------------------
def clt_summary(population, sample_means, n):
    """Compare the spread of observed sample means with the CLT prediction sigma / sqrt(n)."""
    population, sample_means = np.asarray(population, float), np.asarray(sample_means, float)
    sigma = population.std()                       # population SD (ddof=0)
    predicted_se = sigma / sqrt(n)
    observed_se = sample_means.std(ddof=1) if len(sample_means) > 1 else float("nan")
    return {
        "population_mean": float(population.mean()),
        "population_sd": float(sigma),
        "mean_of_sample_means": float(sample_means.mean()) if len(sample_means) else float("nan"),
        "predicted_se": float(predicted_se),
        "observed_se": float(observed_se),
        "samples": int(len(sample_means)),
    }


# ---------------------------------------------------------------------------
# Summary statistics (EDA)
# ---------------------------------------------------------------------------
def describe(values):
    """Five-number summary plus mean and SD, with 1.5 x IQR outliers."""
    v = np.asarray(values, float)
    q1, median, q3 = np.percentile(v, [25, 50, 75])   # linear interpolation, same as the page
    iqr = q3 - q1
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    return {
        "n": int(len(v)),
        "mean": float(v.mean()),
        "median": float(median),
        "sd": float(v.std(ddof=1)) if len(v) > 1 else 0.0,
        "min": float(v.min()), "q1": float(q1), "q3": float(q3), "max": float(v.max()),
        "iqr": float(iqr),
        "outliers": sorted(float(x) for x in v if x < lo or x > hi),
    }


# ---------------------------------------------------------------------------
# Data wrangling: split, apply, combine
# ---------------------------------------------------------------------------
AGGREGATIONS = {
    "mean": lambda xs: sum(xs) / len(xs),
    "sum": sum,
    "count": len,
    "max": max,
    "min": min,
    "median": lambda xs: float(np.median(xs)),
}


def group_aggregate(rows, key, value, agg="mean", where=None):
    """Plain-Python group_by + aggregate, the same idea as df.group_by(key).agg(...)."""
    if where:
        col, op, threshold = where
        ops = {">": lambda a, b: a > b, ">=": lambda a, b: a >= b, "<": lambda a, b: a < b, "==": lambda a, b: a == b}
        rows = [r for r in rows if ops[op](r[col], threshold)]
    groups = {}
    for r in rows:
        groups.setdefault(r[key], []).append(r[value])
    return {k: float(AGGREGATIONS[agg](vs)) for k, vs in sorted(groups.items())}


# ---------------------------------------------------------------------------
# Gradient descent for the regression line
# ---------------------------------------------------------------------------
def gradient_descent(x, y, learning_rate=0.01, steps=100, start=(0.0, 0.0)):
    """Minimise MSE for y = a + b*x by gradient descent; returns the path of (a, b, mse)."""
    x, y = np.asarray(x, float), np.asarray(y, float)
    a, b = start
    path = []
    for _ in range(steps + 1):
        err = (a + b * x) - y
        path.append((float(a), float(b), float(np.mean(err ** 2))))
        a -= learning_rate * 2 * err.mean()
        b -= learning_rate * 2 * (err * x).mean()
    return {"intercept": path[-1][0], "slope": path[-1][1], "mse": path[-1][2], "path": path}


# ---------------------------------------------------------------------------
# Overfitting: polynomial regression with a train/test split
# ---------------------------------------------------------------------------
def _scale(x):
    return (np.asarray(x, float) - 5.0) / 5.0      # map [0, 10] to [-1, 1] for stable fits


def poly_fit(x_train, y_train, x_test, y_test, degree):
    """Least-squares polynomial of a given degree; returns train and test MSE."""
    coeffs = np.polyfit(_scale(x_train), np.asarray(y_train, float), degree)
    pred = lambda xs: np.polyval(coeffs, _scale(xs))
    train_mse = float(np.mean((pred(x_train) - np.asarray(y_train, float)) ** 2))
    test_mse = float(np.mean((pred(x_test) - np.asarray(y_test, float)) ** 2)) if len(x_test) else float("nan")
    return {"degree": degree, "coefficients": coeffs.tolist(), "train_mse": train_mse, "test_mse": test_mse}


def error_curve(x_train, y_train, x_test, y_test, max_degree=10):
    return [poly_fit(x_train, y_train, x_test, y_test, d) for d in range(max_degree + 1)]


# ---------------------------------------------------------------------------
# Classification: k-nearest neighbours
# ---------------------------------------------------------------------------
def knn_predict(train_points, train_labels, query_points, k):
    """Majority vote among the k nearest training points; ties go to the nearest neighbour's label."""
    P, labels = np.asarray(train_points, float), np.asarray(train_labels)
    preds = []
    for q in np.atleast_2d(np.asarray(query_points, float)):
        order = np.argsort(((P - q) ** 2).sum(axis=1), kind="stable")[:k]
        votes = {}
        for i in order:
            votes[labels[i].item()] = votes.get(labels[i].item(), 0) + 1
        best = max(votes.values())
        tied = [lab for lab, v in votes.items() if v == best]
        preds.append(tied[0] if len(tied) == 1 else next(labels[i].item() for i in order if labels[i].item() in tied))
    return preds


def classification_report(y_true, y_pred, positive=1):
    y_true, y_pred = np.asarray(y_true), np.asarray(y_pred)
    tp = int(((y_true == positive) & (y_pred == positive)).sum())
    tn = int(((y_true != positive) & (y_pred != positive)).sum())
    fp = int(((y_true != positive) & (y_pred == positive)).sum())
    fn = int(((y_true == positive) & (y_pred != positive)).sum())
    return {
        "accuracy": (tp + tn) / len(y_true) if len(y_true) else float("nan"),
        "precision": tp / (tp + fp) if tp + fp else 0.0,
        "recall": tp / (tp + fn) if tp + fn else 0.0,
        "confusion": {"tp": tp, "fp": fp, "fn": fn, "tn": tn},
    }


# ---------------------------------------------------------------------------
# Network analysis: degree and PageRank
# ---------------------------------------------------------------------------
def pagerank(n_nodes, edges, damping=0.85, iterations=100, directed=False):
    """PageRank by power iteration. Nodes with no links share their rank with everyone."""
    out = [[] for _ in range(n_nodes)]
    for u, v in edges:
        out[u].append(v)
        if not directed:
            out[v].append(u)
    rank = np.full(n_nodes, 1 / n_nodes)
    for _ in range(iterations):
        new = np.full(n_nodes, (1 - damping) / n_nodes)
        for u in range(n_nodes):
            if out[u]:
                for v in out[u]:
                    new[v] += damping * rank[u] / len(out[u])
            else:
                new += damping * rank[u] / n_nodes
        rank = new
    degree = [len(o) for o in out]
    return {"pagerank": rank.tolist(), "degree": degree}


def shortest_path_lengths(n_nodes, edges, source):
    """Breadth-first search distances from `source` (None = unreachable)."""
    adj = [[] for _ in range(n_nodes)]
    for u, v in edges:
        adj[u].append(v)
        adj[v].append(u)
    dist = [None] * n_nodes
    dist[source] = 0
    queue = [source]
    for u in queue:
        for v in adj[u]:
            if dist[v] is None:
                dist[v] = dist[u] + 1
                queue.append(v)
    return dist


if __name__ == "__main__":
    rng = np.random.default_rng(0)
    x = rng.uniform(0, 10, 30)
    y = 2 + 0.5 * x + rng.normal(0, 1, 30)
    print("fit_line:", fit_line(x, y))
    pts = np.vstack([rng.normal(c, 0.6, (40, 2)) for c in [(2, 2), (7, 3), (5, 8)]])
    print("kmeans inertia:", round(kmeans(pts, 3, seed=1)["inertia"], 2))
    print("ab_test:", ab_test(100, 1000, 125, 1000))
    print("power (10% vs 12%, n=1000):", simulate_power(0.10, 0.12, 1000, seed=2))
