/*
 * Historical Crop Yield UI
 * Version: 2026-09-14-trained-yield-v11
 *
 * Purpose:
 * - Farmer-friendly yield estimation UI
 * - Sends validated farm data to /predict_yield
 * - Safely displays trained-model predictions
 * - Handles API/network failures gracefully
 * - Uses tonnes/hectare internally
 * - Converts results to tonnes/acre and total production
 */

(() => {
  "use strict";

  const VERSION = "2026-09-14-trained-yield-v11";

  /*
   * Prevent duplicate execution.
   */
  if (window.__KISAN_TRAINED_YIELD__ === VERSION) {
    return;
  }

  window.__KISAN_TRAINED_YIELD__ = VERSION;

  /* =========================================================
     Constants
  ========================================================= */

  const API_ENDPOINT = "/predict_yield";

  const REQUEST_TIMEOUT_MS = 10000;

  const HECTARE_TO_ACRE = 2.4710538147;

  const ACRE_TO_HECTARE = 0.40468564224;

  const MIN_YEAR = 1997;
  const MAX_YEAR = 2100;

  const MAX_AREA_ACRE = 10000;

  const MAX_RAINFALL_MM = 10000;

  const states = Object.freeze([
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Delhi",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jammu and Kashmir",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Puducherry",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal"
  ]);

  const crops = Object.freeze([
    "Arecanut",
    "Arhar/Tur",
    "Bajra",
    "Banana",
    "Barley",
    "Black pepper",
    "Cardamom",
    "Cashewnut",
    "Castor seed",
    "Coconut",
    "Coriander",
    "Cotton(lint)",
    "Cowpea(Lobia)",
    "Dry chillies",
    "Garlic",
    "Ginger",
    "Gram",
    "Grapes",
    "Groundnut",
    "Guar seed",
    "Horse-gram",
    "Jowar",
    "Jute",
    "Khesari",
    "Lentil",
    "Linseed",
    "Maize",
    "Mango",
    "Masoor",
    "Mesta",
    "Moong",
    "Moong(Green Gram)",
    "Moth",
    "Mustard",
    "Niger seed",
    "Oilseeds total",
    "Onion",
    "Other Rabi pulses",
    "Other Cereals",
    "Other Kharif pulses",
    "Other Summer Pulses",
    "Peas & beans (Pulses)",
    "Potato",
    "Ragi",
    "Rapeseed &Mustard",
    "Rice",
    "Rubber",
    "Safflower",
    "Sannhamp",
    "Sesamum",
    "Small millets",
    "Soyabean",
    "Sugarcane",
    "Sunflower",
    "Sweet potato",
    "Tapioca",
    "Tobacco",
    "Tomato",
    "Turmeric",
    "Urad",
    "Wheat",
    "other oilseeds"
  ]);

  const seasons = Object.freeze([
    "Autumn",
    "Kharif",
    "Rabi",
    "Summer",
    "Whole Year",
    "Winter"
  ]);

  /* =========================================================
     Utility functions
  ========================================================= */

  const getElement = (id) => {
    return document.getElementById(id);
  };

  const escapeHtml = (value) => {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (character) => {
        const entities = {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        };

        return entities[character] || character;
      }
    );
  };

  const toFiniteNumber = (value) => {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : null;
  };

  const safeText = (
    value,
    fallback = ""
  ) => {
    const text = String(
      value ?? ""
    ).trim();

    return text || fallback;
  };

  const round = (
    value,
    decimals = 2
  ) => {
    if (!Number.isFinite(value)) {
      return null;
    }

    return Number(
      value.toFixed(decimals)
    );
  };

  const formatNumber = (
    value,
    decimals = 2
  ) => {
    if (!Number.isFinite(value)) {
      return "—";
    }

    return value.toLocaleString(
      "en-IN",
      {
        minimumFractionDigits:
          decimals,
        maximumFractionDigits:
          decimals
      }
    );
  };

  const createOptions = (
    values
  ) => {
    return values
      .map(
        (value) =>
          `<option value="${escapeHtml(
            value
          )}">${escapeHtml(
            value
          )}</option>`
      )
      .join("");
  };

  /* =========================================================
     Input validation
  ========================================================= */

  function validateInput(data) {
    const errors = [];

    if (!data.state) {
      errors.push(
        "Select a state."
      );
    }

    if (!data.crop) {
      errors.push(
        "Select a crop."
      );
    }

    if (!data.season) {
      errors.push(
        "Select a season."
      );
    }

    if (
      data.year === null ||
      data.year < MIN_YEAR ||
      data.year > MAX_YEAR
    ) {
      errors.push(
        `Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`
      );
    }

    if (
      data.areaAcre === null ||
      data.areaAcre <= 0 ||
      data.areaAcre > MAX_AREA_ACRE
    ) {
      errors.push(
        `Area must be greater than 0 and no more than ${MAX_AREA_ACRE.toLocaleString(
          "en-IN"
        )} acres.`
      );
    }

    if (
      data.rainfall === null ||
      data.rainfall < 0 ||
      data.rainfall > MAX_RAINFALL_MM
    ) {
      errors.push(
        `Rainfall must be between 0 and ${MAX_RAINFALL_MM.toLocaleString(
          "en-IN"
        )} mm.`
      );
    }

    if (
      data.fertilizer === null ||
      data.fertilizer < 0
    ) {
      errors.push(
        "Fertilizer cannot be negative."
      );
    }

    if (
      data.pesticide === null ||
      data.pesticide < 0
    ) {
      errors.push(
        "Pesticide cannot be negative."
      );
    }

    return errors;
  }

  /* =========================================================
     UI installation
  ========================================================= */

  function install() {
    const output =
      getElement("yieldResult");

    if (!output) {
      return false;
    }

    /*
     * Prevent reinstalling the same controls.
     */
    if (
      getElement(
        "trainedYieldInputs"
      )
    ) {
      return true;
    }

    const container =
      output.parentElement;

    if (!container) {
      return false;
    }

    /*
     * Remove conflicting legacy controls.
     */
    container
      .querySelectorAll(
        "#yieldModelButton"
      )
      .forEach(
        (element) =>
          element.remove()
      );

    container
      .querySelectorAll(
        "#trainedYieldInputs"
      )
      .forEach(
        (element) =>
          element.remove()
      );

    /*
     * Remove old humidity/rainfall
     * controls if the previous UI added them.
     */
    [
      "yieldHumidityInput",
      "yieldRainInput"
    ].forEach(
      (id) => {
        const element =
          getElement(id);

        element
          ?.closest(
            ".form-group"
          )
          ?.remove();
      }
    );

    /*
     * Remove legacy inline prediction buttons.
     */
    container
      .querySelectorAll(
        'button[onclick="predictYield()"]'
      )
      .forEach(
        (button) =>
          button.remove()
      );

    /*
     * Update title.
     */
    getElement(
      "t-yieldTitle"
    )?.replaceChildren(
      document.createTextNode(
        "📈 Crop Yield Estimate"
      )
    );

    /* ---------------------------------------------
       Input box
    --------------------------------------------- */

    const box =
      document.createElement(
        "div"
      );

    box.id =
      "trainedYieldInputs";

    box.style.cssText = `
      display:grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap:10px;
      margin:12px 0;
    `;

    const currentYear =
      new Date().getFullYear();

    box.innerHTML = `
      <div class="form-group">
        <label for="yieldState">
          State
        </label>

        <select
          id="yieldState"
          autocomplete="address-level1"
        >
          <option value="">
            Select state
          </option>

          ${createOptions(states)}
        </select>
      </div>

      <div class="form-group">
        <label for="yieldCrop">
          Crop
        </label>

        <select
          id="yieldCrop"
        >
          <option value="">
            Select crop
          </option>

          ${createOptions(crops)}
        </select>
      </div>

      <div class="form-group">
        <label for="yieldSeason">
          Season
        </label>

        <select
          id="yieldSeason"
        >
          <option value="">
            Select season
          </option>

          ${createOptions(seasons)}
        </select>
      </div>

      <div class="form-group">
        <label for="yieldYear">
          Year
        </label>

        <input
          id="yieldYear"
          type="number"
          min="${MIN_YEAR}"
          max="${MAX_YEAR}"
          step="1"
          value="${currentYear}"
          inputmode="numeric"
        />
      </div>

      <div class="form-group">
        <label for="yieldArea">
          Area (acre)
        </label>

        <input
          id="yieldArea"
          type="number"
          min="0.01"
          max="${MAX_AREA_ACRE}"
          step="0.01"
          value="1"
          inputmode="decimal"
        />

        <small
          style="
            display:block;
            opacity:.65;
            margin-top:3px;
          "
        >
          1 acre ≈ 0.404686 hectare
        </small>
      </div>

      <div class="form-group">
        <label for="yieldRainfallModel">
          Annual Rainfall (mm)
        </label>

        <input
          id="yieldRainfallModel"
          type="number"
          min="0"
          max="${MAX_RAINFALL_MM}"
          step="1"
          value="800"
          inputmode="decimal"
        />

        <small
          style="
            display:block;
            opacity:.65;
            margin-top:3px;
          "
        >
          Used as a model input.
        </small>
      </div>

      <div class="form-group">
        <label for="yieldFertilizerModel">
          Fertilizer (kg)
        </label>

        <input
          id="yieldFertilizerModel"
          type="number"
          min="0"
          step="0.1"
          value="100"
          inputmode="decimal"
        />
      </div>

      <div class="form-group">
        <label for="yieldPesticideModel">
          Pesticide (kg)
        </label>

        <input
          id="yieldPesticideModel"
          type="number"
          min="0"
          step="0.1"
          value="10"
          inputmode="decimal"
        />
      </div>
    `;

    output.parentNode.insertBefore(
      box,
      output
    );

    /* ---------------------------------------------
       Button
    --------------------------------------------- */

    const button =
      document.createElement(
        "button"
      );

    button.type = "button";

    button.id =
      "yieldModelButton";

    button.className =
      "btn-primary";

    button.textContent =
      "Estimate Crop Yield";

    button.setAttribute(
      "aria-controls",
      "yieldResult"
    );

    button.addEventListener(
      "click",
      predictYield
    );

    output.parentNode.insertBefore(
      button,
      output
    );

    /* ---------------------------------------------
       Initial state
    --------------------------------------------- */

    output.innerHTML = `
      <div
        style="
          opacity:.75;
          line-height:1.45;
        "
      >
        Enter your farm details
        and click
        <b>Estimate Crop Yield</b>.
      </div>
    `;

    return true;
  }

  /* =========================================================
     Confidence handling
  ========================================================= */

  function getConfidenceInfo(
    confidence
  ) {
    const value =
      safeText(
        confidence
      ).toLowerCase();

    if (
      value === "high"
    ) {
      return {
        label: "High",
        text:
          "The prediction is relatively consistent with the model's learned patterns."
      };
    }

    if (
      value === "medium"
    ) {
      return {
        label: "Medium",
        text:
          "The prediction has moderate uncertainty and should be used as an estimate."
      };
    }

    if (
      value === "low"
    ) {
      return {
        label: "Low",
        text:
          "The prediction has higher uncertainty. Use it as a rough estimate."
      };
    }

    return {
      label: "Not specified",
      text:
        "The model did not provide a confidence level."
    };
  }

  /* =========================================================
     Explanation
  ========================================================= */

  function buildExplanation(
    data
  ) {
    const note =
      safeText(
        data.note
      );

    const lower =
      note.toLowerCase();

    if (
      /outside the historical dataset/.test(
        lower
      ) ||
      /future forecast/.test(
        lower
      ) ||
      /outside.*training range/.test(
        lower
      )
    ) {
      return (
        "Some inputs differ from the historical data used by the model, so the prediction may be less certain."
      );
    }

    if (
      /limited data/.test(
        lower
      ) ||
      /insufficient data/.test(
        lower
      )
    ) {
      return (
        "The model has limited historical information for this combination of inputs."
      );
    }

    if (note) {
      return note;
    }

    return (
      "This estimate is generated from the trained model using historical crop and agricultural data."
    );
  }

  /* =========================================================
     Server response validation
  ========================================================= */

  function validateServerResponse(
    data
  ) {
    if (
      !data ||
      typeof data !== "object"
    ) {
      return {
        valid: false,
        reason:
          "The server returned an invalid response."
      };
    }

    if (
      data.success !== true
    ) {
      return {
        valid: false,
        reason:
          safeText(
            data.error,
            "The yield model could not generate a prediction."
          )
      };
    }

    const yieldTpha =
      toFiniteNumber(
        data.yield_tpha
      );

    if (
      yieldTpha === null
    ) {
      return {
        valid: false,
        reason:
          "The model did not return a valid yield value."
      };
    }

    /*
     * Yield cannot be negative.
     */
    if (
      yieldTpha < 0
    ) {
      return {
        valid: false,
        reason:
          "The model returned an invalid negative yield."
      };
    }

    /*
     * Prevent obviously corrupt values.
     * This is a safety check, not an agronomic upper limit.
     */
    if (
      yieldTpha > 1000
    ) {
      return {
        valid: false,
        reason:
          "The model returned an unrealistic yield value."
      };
    }

    /*
     * Optional confidence validation.
     */
    if (
      data.confidence !== undefined &&
      data.confidence !== null
    ) {
      const confidence =
        String(
          data.confidence
        ).toLowerCase();

      const validConfidence =
        [
          "high",
          "medium",
          "low"
        ].includes(
          confidence
        );

      if (!validConfidence) {
        /*
         * Don't reject an otherwise valid
         * prediction because of an unknown
         * confidence label.
         */
        data.confidence =
          "Unknown";
      }
    }

    return {
      valid: true
    };
  }

  /* =========================================================
     Unit calculations
  ========================================================= */

  function calculateProduction(
    yieldTpha,
    areaAcre
  ) {
    /*
     * yieldTpha:
     * tonnes/hectare
     *
     * area:
     * acres
     *
     * Therefore:
     *
     * tonnes/hectare
     * ×
     * hectares
     *
     * = tonnes
     */

    const areaHectare =
      areaAcre *
      ACRE_TO_HECTARE;

    const productionTonnes =
      yieldTpha *
      areaHectare;

    const yieldTpa =
      yieldTpha *
      ACRE_TO_HECTARE;

    return {
      areaHectare,
      productionTonnes,
      yieldTpa
    };
  }

  /* =========================================================
     Range handling
  ========================================================= */

  function getPredictionRange(
    data
  ) {
    const range =
      data?.indicative_range_tpha;

    if (
      !range ||
      typeof range !== "object"
    ) {
      return null;
    }

    const low =
      toFiniteNumber(
        range.low
      );

    const high =
      toFiniteNumber(
        range.high
      );

    if (
      low === null ||
      high === null ||
      low < 0 ||
      high < low
    ) {
      return null;
    }

    return {
      low,
      high
    };
  }

  /* =========================================================
     Rendering
  ========================================================= */

  function render(
    data,
    params
  ) {
    const output =
      getElement(
        "yieldResult"
      );

    if (!output) {
      return;
    }

    const yieldTpha =
      toFiniteNumber(
        data.yield_tpha
      );

    if (
      yieldTpha === null
    ) {
      output.innerHTML = `
        <div
          style="
            color:#fecaca;
            padding:12px;
          "
        >
          The model did not return
          a valid yield estimate.
        </div>
      `;

      return;
    }

    const {
      areaHectare,
      productionTonnes,
      yieldTpa
    } =
      calculateProduction(
        yieldTpha,
        params.areaAcre
      );

    const confidence =
      getConfidenceInfo(
        data.confidence
      );

    const explanation =
      buildExplanation(
        data
      );

    const predictionRange =
      getPredictionRange(
        data
      );

    let rangeHtml =
      "";

    if (
      predictionRange
    ) {
      rangeHtml = `
        <div
          style="
            margin-top:10px;
            font-size:.9rem;
          "
        >
          <b>Indicative yield range:</b>
          ${formatNumber(
        predictionRange.low
      )}
          –
          ${formatNumber(
        predictionRange.high
      )}
          tonnes/hectare
        </div>
      `;
    }

    const cropName =
      safeText(
        data.crop ||
        params.crop,
        params.crop
      );

    const stateName =
      safeText(
        data.state ||
        params.state,
        params.state
      );

    const seasonName =
      safeText(
        data.season ||
        params.season,
        params.season
      );

    output.innerHTML = `
      <div
        style="
          padding:16px;
          border-radius:14px;
          border:1px solid
            rgba(52,211,153,.35);
          background:
            rgba(16,185,129,.08);
        "
      >

        <div
          style="
            font-size:.9rem;
            opacity:.8;
            letter-spacing:.02em;
          "
        >
          CROP YIELD ESTIMATE
        </div>

        <div
          style="
            font-size:1.55rem;
            font-weight:800;
            color:var(--accent-green);
            margin-top:4px;
          "
        >
          ${formatNumber(
      yieldTpha
    )}
          tonnes/hectare
        </div>

        <div
          style="
            margin-top:4px;
            font-size:.9rem;
            opacity:.8;
          "
        >
          Approximately
          <b>
            ${formatNumber(
      yieldTpa
    )}
          </b>
          tonnes/acre
        </div>

        <div
          style="
            margin-top:14px;
            padding:11px;
            border-radius:10px;
            background:
              rgba(255,255,255,.05);
          "
        >
          <b>
            Your field
          </b>

          <div
            style="
              margin-top:5px;
              font-size:.88rem;
              opacity:.85;
            "
          >
            ${formatNumber(
      params.areaAcre
    )}
            acre
            (${formatNumber(
      areaHectare
    )}
            hectare)
          </div>

          <div
            style="
              margin-top:5px;
            "
          >
            Expected production:
            <b>
              ${formatNumber(
      productionTonnes
    )}
              tonnes
            </b>
          </div>
        </div>

        <div
          style="
            margin-top:11px;
            font-size:.9rem;
          "
        >
          <b>Crop:</b>
          ${escapeHtml(
      cropName
    )}
        </div>

        <div
          style="
            margin-top:4px;
            font-size:.9rem;
          "
        >
          <b>State:</b>
          ${escapeHtml(
      stateName
    )}
        </div>

        <div
          style="
            margin-top:4px;
            font-size:.9rem;
          "
        >
          <b>Season:</b>
          ${escapeHtml(
      seasonName
    )}
        </div>

        ${rangeHtml}

        <div
          style="
            margin-top:11px;
          "
        >
          <b>
            Confidence:
            ${escapeHtml(
      confidence.label
    )}
          </b>

          <div
            style="
              font-size:.82rem;
              opacity:.75;
              margin-top:3px;
              line-height:1.4;
            "
          >
            ${escapeHtml(
      confidence.text
    )}
          </div>
        </div>

        <div
          style="
            margin-top:11px;
            font-size:.82rem;
            opacity:.78;
            line-height:1.45;
          "
        >
          💡
          ${escapeHtml(
      explanation
    )}
        </div>

        <div
          style="
            margin-top:10px;
            font-size:.7rem;
            opacity:.45;
          "
        >
          Prediction generated by
          the trained yield model.
        </div>

      </div>
    `;
  }

  /* =========================================================
     Read form
  ========================================================= */

  function readForm() {
    const getValue =
      (id) =>
        getElement(id)?.value
          ?.trim() || "";

    return {
      state:
        getValue(
          "yieldState"
        ),

      crop:
        getValue(
          "yieldCrop"
        ),

      season:
        getValue(
          "yieldSeason"
        ),

      year:
        toFiniteNumber(
          getValue(
            "yieldYear"
          )
        ),

      areaAcre:
        toFiniteNumber(
          getValue(
            "yieldArea"
          )
        ),

      rainfall:
        toFiniteNumber(
          getValue(
            "yieldRainfallModel"
          )
        ),

      fertilizer:
        toFiniteNumber(
          getValue(
            "yieldFertilizerModel"
          )
        ),

      pesticide:
        toFiniteNumber(
          getValue(
            "yieldPesticideModel"
          )
        )
    };
  }

  /* =========================================================
     Error renderer
  ========================================================= */

  function renderError(
    message
  ) {
    const output =
      getElement(
        "yieldResult"
      );

    if (!output) {
      return;
    }

    output.innerHTML = `
      <div
        role="alert"
        style="
          padding:12px;
          border-radius:10px;
          border:1px solid
            rgba(248,113,113,.35);
          background:
            rgba(248,113,113,.06);
          color:#fecaca;
          line-height:1.45;
        "
      >
        ${escapeHtml(
      message
    )}
      </div>
    `;
  }

  /* =========================================================
     API request
  ========================================================= */

  async function requestPrediction(
    payload
  ) {
    const controller =
      new AbortController();

    const timeout =
      window.setTimeout(
        () => {
          controller.abort();
        },
        REQUEST_TIMEOUT_MS
      );

    try {
      const response =
        await fetch(
          API_ENDPOINT,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              "Accept":
                "application/json"
            },

            credentials:
              "same-origin",

            cache:
              "no-store",

            signal:
              controller.signal,

            body:
              JSON.stringify(
                payload
              )
          }
        );

      const data =
        await response
          .json()
          .catch(
            () => null
          );

      return {
        response,
        data
      };

    } finally {
      window.clearTimeout(
        timeout
      );
    }
  }

  /* =========================================================
     Main prediction
  ========================================================= */

  async function predictYield() {
    /*
     * Make sure the UI exists.
     */
    if (
      !getElement(
        "trainedYieldInputs"
      )
    ) {
      const installed =
        install();

      if (!installed) {
        return;
      }
    }

    const output =
      getElement(
        "yieldResult"
      );

    const button =
      getElement(
        "yieldModelButton"
      );

    if (!output) {
      return;
    }

    const params =
      readForm();

    /* ---------------------------------------------
       Validation
    --------------------------------------------- */

    const errors =
      validateInput(
        params
      );

    if (
      errors.length
    ) {
      renderError(
        errors.join(" ")
      );

      return;
    }

    /* ---------------------------------------------
       Loading state
    --------------------------------------------- */

    if (button) {
      button.disabled = true;
      button.textContent =
        "Calculating…";
    }

    output.innerHTML = `
      <div
        style="
          opacity:.75;
          line-height:1.45;
        "
      >
        Calculating your crop
        yield estimate using
        the trained model…
      </div>
    `;

    /*
     * API payload.
     *
     * Keep these names synchronized with
     * the backend /predict_yield endpoint.
     */
    const payload = {
      state:
        params.state,

      crop:
        params.crop,

      season:
        params.season,

      year:
        params.year,

      area_acre:
        params.areaAcre,

      rainfall:
        params.rainfall,

      fertilizer:
        params.fertilizer,

      pesticide:
        params.pesticide
    };

    try {
      const {
        response,
        data
      } =
        await requestPrediction(
          payload
        );

      /*
       * Validate model response.
       */
      const validation =
        validateServerResponse(
          data
        );

      if (
        !response.ok
      ) {
        renderError(
          safeText(
            data?.error,
            `Yield service returned HTTP ${response.status}.`
          )
        );

        return;
      }

      if (
        !validation.valid
      ) {
        renderError(
          validation.reason
        );

        return;
      }

      /*
       * Successful prediction.
       */
      render(
        data,
        params
      );

    } catch (error) {
      let message =
        "The yield service is temporarily unavailable. Please try again.";

      if (
        error?.name ===
        "AbortError"
      ) {
        message =
          "The yield calculation took too long. Please try again.";
      }

      renderError(
        message
      );

      /*
       * Development logging only.
       */
      if (
        window.location.hostname ===
        "localhost"
      ) {
        console.warn(
          "Yield prediction error:",
          error
        );
      }

    } finally {
      if (button) {
        button.disabled =
          false;

        button.textContent =
          "Estimate Crop Yield";
      }
    }
  }

  /* =========================================================
     Public API
  ========================================================= */

  window.predictYield =
    predictYield;

  /* =========================================================
     Initialization
  ========================================================= */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      install,
      {
        once: true
      }
    );
  } else {
    install();
  }

})();