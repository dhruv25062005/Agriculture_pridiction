# Yield model

The dashboard uses a leakage-safe historical baseline with a bounded agronomic calibration layer.

- Target: Yield (tonnes/hectare)
- Historical baseline: crop + state + season target encoding
- Production is excluded because Yield is derived from Production / Area.
- Area is entered by the user in **acres** and converted using 1 acre = 0.40468564224 hectare.
- Area is never used as a direct yield multiplier. It is used for total production and to normalize fertilizer/pesticide into kg/ha.
- Fertilizer and pesticide are normalized to kg/ha before their small bounded corrections are applied.
- Rainfall receives a crop-specific bounded correction rather than dominating the historical signal.
- Crop/season mismatch lowers confidence instead of causing a prediction failure.
- The API returns an indicative prediction interval and confidence level.

The underlying historical dataset contains substantial yield outliers/unit inconsistencies, so the model uses conservative crop-specific bounds. The underlying held-out metrics are retained for transparency and are not a guarantee of farm yield.
