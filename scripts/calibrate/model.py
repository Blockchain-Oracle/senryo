"""R3.2 calibration: the pricing model the fit tunes and the check scores (D-300), in floating point.

    σ_τ² = σ_L² + (σ_m² − σ_L²) · a · g(κτ),   g(x) = (1 − e^{−x}) / x
    u = ln(P(t + τ) / P(t)) / (σ_τ √τ),     P(close > edge) = 1 − F_τ(ln(edge / spot) / (σ_τ √τ))

σ_m is the keeper's 1-minute EWMA mark, σ_L the series' long-run σ, a how much of the mark's departure from the long
run to trust at all (the EWMA is a noisy estimate) and κ how fast what's left fades over the horizon (volatility
mean-reverts: a quiet half hour under-predicts the next one). F_τ is the symmetric shape table at horizon
τ, linear in τ between the table's horizons and in z between its points. `BandMath.sol` computes the same in fixed
point (R3.3).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from samples import Samples

MIN_SECONDS_LEFT = 5


def fade(kappa: float, tau: np.ndarray) -> np.ndarray:
    """g(κτ) = (1 − e^{−κτ}) / (κτ); 1 at κ = 0."""
    if kappa == 0:
        return np.ones_like(tau, dtype=float)
    x = kappa * np.asarray(tau, dtype=float)
    return -np.expm1(-x) / x


def sigma_at(sigma_mark: np.ndarray, sigma_long: np.ndarray, weight: float, kappa: float, tau: np.ndarray) -> np.ndarray:
    var = sigma_long**2 + (sigma_mark**2 - sigma_long**2) * weight * fade(kappa, tau)
    return np.sqrt(np.maximum(var, 0.0))


def standardised(s: Samples, weight: float, kappa: float, scale: float) -> np.ndarray:
    tau = np.maximum(s.tau, MIN_SECONDS_LEFT)
    return s.r / (sigma_at(s.sigma_mark, s.sigma_long * scale, weight, kappa, tau) * np.sqrt(tau))


@dataclass
class ShapeTable:
    """F_τ(z) for z ≥ 0 at each horizon (rows) and grid point (columns); F_τ(−z) = 1 − F_τ(z)."""

    taus: np.ndarray
    z_step: float
    cdf: np.ndarray  # shape (len(taus), points), cdf[:, 0] == 0.5

    def __call__(self, z: np.ndarray, tau: np.ndarray) -> np.ndarray:
        z = np.asarray(z, dtype=float)
        tau = np.clip(np.asarray(tau, dtype=float), self.taus[0], self.taus[-1])
        a = np.abs(z)
        last = self.cdf.shape[1] - 1
        pos = np.minimum(a / self.z_step, last)
        i = np.minimum(np.floor(pos).astype(int), last - 1)
        frac = pos - i
        j = np.clip(np.searchsorted(self.taus, tau, side="right") - 1, 0, len(self.taus) - 2)
        w = (tau - self.taus[j]) / (self.taus[j + 1] - self.taus[j])

        def row(k: np.ndarray) -> np.ndarray:
            lo, hi = self.cdf[k, i], self.cdf[k, i + 1]
            return lo + (hi - lo) * frac

        f = row(j) * (1 - w) + row(j + 1) * w
        f = np.where(a >= last * self.z_step, 1.0, f)
        return np.where(z < 0, 1 - f, f)


def above(table: ShapeTable, edge_ratio: np.ndarray, sigma: np.ndarray, tau: np.ndarray) -> np.ndarray:
    """P(close > edge) when edge / spot = `edge_ratio`."""
    tau = np.maximum(tau, MIN_SECONDS_LEFT)
    z = np.log(edge_ratio) / (sigma * np.sqrt(tau))
    return 1 - table(z, tau)
