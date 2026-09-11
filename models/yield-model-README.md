# Yield model

The dashboard uses a leakage-safe historical baseline with a conservative sanity layer.

## What the model actually learns

- Target: Yield (tonnes/hectare)
- Learned features: **Crop + State + Season** target encodings
- Historical source period: **1997–2020**
- Production is excluded because `Yield = Production / Area`.
- Area entered by the user is in **acres** and is converted using `1 acre = 0.40468564224 hectare`.
- Area affects total production only; it cannot directly inflate or reduce t/ha.

## Inputs intentionally not used as pseudo-features

The dashboard collects annual rainfall, fertilizer and pesticide so the farm record remains useful and ready for a future retrained model. They are **not currently converted into yield adjustments** because the historical training data contains aggregate state/crop records, while the dashboard inputs are farm-level values. Mixing those units would create false precision.

## Validation and uncertainty

- The displayed historical metrics come from the existing held-out evaluation and should not be described as future-year accuracy.
- The current evaluation is a random historical holdout; **temporal validation has not yet been established**.
- For years after 2020, the system explicitly lowers confidence instead of extrapolating a fabricated trend.
- The displayed range is an **indicative uncertainty band**, anchored to held-out median absolute error. It is not a calibrated prediction interval.
- Crop-specific sanity bounds prevent obvious unit/outlier failures from being presented as realistic farm yields.
- Unsupported states/crops/seasons are rejected instead of silently falling back to a global average.

## Next model upgrade

For production-grade forecasting, retrain on a reproducible, cleaned dataset with chronological train/validation/test splits and farm-compatible features such as crop-cycle rainfall, temperature, soil properties, irrigation status, sowing date and validated input rates. Official Indian APY statistics provide a stronger provenance source for future retraining.
