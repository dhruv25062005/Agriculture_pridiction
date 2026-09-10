# Yield model

This model is trained from the supplied India crop-yield train/test CSV files.

- Train rows: 17,400
- Test rows: 4,350
- Target: Yield (tonnes/hectare)
- Production is excluded from prediction to avoid target leakage.
- Model: smoothed historical median target encoder using crop, state and season.
- Test MAE: 39.319581 t/ha
- Test RMSE: 462.773843 t/ha
- Test R²: 0.759336
- Test median absolute error: 0.438653 t/ha

The model is an indicative historical baseline, not a guaranteed farm yield forecast. The dataset contains extreme yield values, which make RMSE much larger than the median absolute error.
