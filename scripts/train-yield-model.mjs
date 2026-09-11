import fs from "fs/promises";
import path from "path";

const SOURCE_URL = "https://raw.githubusercontent.com/Aaditya210905/Machine-Learning-Crop-Yield-Prediction/8534badcbf8b5e99dcb08a842e041410d7967cc3/data/crop_yield.csv";
const OUT = "models/yield-model-artifact.json";

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const p = lines[i].split(",");
    if (p.length < 10) continue;
    const crop = p[0].trim();
    const year = Number(p[1]);
    const season = p[2].trim();
    const state = p[3].trim();
    const area = Number(p[4]);
    const rainfall = Number(p[6]);
    const fertilizer = Number(p[7]);
    const pesticide = Number(p[8]);
    const yieldTpha = Number(p[9]);
    if (!crop || !season || !state || !Number.isFinite(year) || !Number.isFinite(area) || area <= 0 || !Number.isFinite(yieldTpha) || yieldTpha < 0) continue;
    rows.push({ crop, year, season, state, rainfall, fertilizerPerHa: fertilizer / area, pesticidePerHa: pesticide / area, yieldTpha });
  }
  return rows;
}

function mean(values) { return values.reduce((s, x) => s + x, 0) / values.length; }
function sd(values, m) {
  const variance = values.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, values.length - 1);
  return Math.sqrt(variance) || 1;
}
function uniqueSorted(rows, key) { return [...new Set(rows.map(r => r[key]))].sort(); }

function solve(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let pivot = i;
    let best = Math.abs(A[i][i]);
    for (let r = i + 1; r < n; r++) {
      const value = Math.abs(A[r][i]);
      if (value > best) { best = value; pivot = r; }
    }
    if (best < 1e-12) A[i][i] += 1e-8;
    if (pivot !== i) {
      [A[i], A[pivot]] = [A[pivot], A[i]];
      [b[i], b[pivot]] = [b[pivot], b[i]];
    }
    const diagonal = A[i][i];
    for (let r = i + 1; r < n; r++) {
      const factor = A[r][i] / diagonal;
      if (Math.abs(factor) < 1e-14) continue;
      A[r][i] = 0;
      for (let c = i + 1; c < n; c++) A[r][c] -= factor * A[i][c];
      b[r] -= factor * b[i];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let value = b[i];
    for (let c = i + 1; c < n; c++) value -= A[i][c] * x[c];
    x[i] = value / (A[i][i] || 1e-8);
  }
  return x;
}

function metrics(actual, predicted) {
  const n = actual.length;
  const mae = actual.reduce((s, y, i) => s + Math.abs(y - predicted[i]), 0) / n;
  const mse = actual.reduce((s, y, i) => s + (y - predicted[i]) ** 2, 0) / n;
  const rmse = Math.sqrt(mse);
  const average = mean(actual);
  const ssTot = actual.reduce((s, y) => s + (y - average) ** 2, 0);
  const ssRes = actual.reduce((s, y, i) => s + (y - predicted[i]) ** 2, 0);
  const r2 = ssTot ? 1 - ssRes / ssTot : 0;
  const absolute = actual.map((y, i) => Math.abs(y - predicted[i])).sort((a, b) => a - b);
  const middle = absolute.length % 2 ? absolute[(absolute.length - 1) / 2] : (absolute[absolute.length / 2 - 1] + absolute[absolute.length / 2]) / 2;
  return { maeTpha: mae, rmseTpha: rmse, r2, medianAbsoluteErrorTpha: middle };
}

function buildEncoder(rows) {
  const crops = uniqueSorted(rows, "crop");
  const states = uniqueSorted(rows, "state");
  const seasons = uniqueSorted(rows, "season");
  const train = rows.filter(r => r.year <= 2017);
  const numeric = {};
  for (const key of ["rainfall", "fertilizerPerHa", "pesticidePerHa"]) {
    const values = train.map(r => Math.log1p(Math.max(0, r[key])));
    const m = mean(values);
    numeric[key] = {
      mean: m,
      sd: sd(values, m),
      min: Math.min(...train.map(r => r[key])),
      max: Math.max(...train.map(r => r[key]))
    };
  }
  const yearMean = mean(train.map(r => r.year));
  const yearSd = sd(train.map(r => r.year), yearMean);
  const vector = r => {
    const x = [1];
    for (const c of crops) x.push(c === r.crop ? 1 : 0);
    for (const s of states) x.push(s === r.state ? 1 : 0);
    for (const s of seasons) x.push(s === r.season ? 1 : 0);
    const year = (r.year - yearMean) / yearSd;
    x.push(year, year * year);
    for (const key of ["rainfall", "fertilizerPerHa", "pesticidePerHa"]) {
      const z = (Math.log1p(Math.max(0, r[key])) - numeric[key].mean) / numeric[key].sd;
      x.push(z, z * z);
    }
    for (const c of crops) x.push(r.crop === c ? year : 0);
    return x;
  };
  return { crops, states, seasons, numeric, yearMean, yearSd, vector };
}

function fit(rows, encoder, lambda) {
  const train = rows.filter(r => r.year <= 2017);
  const featureCount = encoder.vector(train[0]).length;
  const A = Array.from({ length: featureCount }, () => new Array(featureCount).fill(0));
  const b = new Array(featureCount).fill(0);
  for (const row of train) {
    const x = encoder.vector(row);
    const y = Math.log1p(row.yieldTpha);
    for (let i = 0; i < featureCount; i++) {
      b[i] += x[i] * y;
      for (let j = 0; j <= i; j++) A[i][j] += x[i] * x[j];
    }
  }
  for (let i = 0; i < featureCount; i++) {
    for (let j = i + 1; j < featureCount; j++) A[i][j] = A[j][i];
    if (i > 0) A[i][i] += lambda;
  }
  return solve(A, b);
}

function predict(rows, encoder, weights) {
  return rows.map(row => Math.max(0, Math.expm1(encoder.vector(row).reduce((sum, value, i) => sum + value * weights[i], 0))));
}

const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`Dataset download failed: HTTP ${response.status}`);
const rows = parseCsv(await response.text());
if (rows.length < 1000) throw new Error(`Dataset unexpectedly small: ${rows.length} rows`);

const encoder = buildEncoder(rows);
const validation = rows.filter(r => r.year >= 2018 && r.year <= 2019);
const temporalTest = rows.filter(r => r.year === 2020);
let best = null;
for (const lambda of [0.01, 0.1, 1, 10, 100]) {
  const weights = fit(rows, encoder, lambda);
  const prediction = predict(validation, encoder, weights);
  const score = metrics(validation.map(r => r.yieldTpha), prediction);
  if (!best || score.maeTpha < best.validation.maeTpha) best = { lambda, weights, validation: score };
}
const temporalPrediction = predict(temporalTest, encoder, best.weights);
const temporalScore = metrics(temporalTest.map(r => r.yieldTpha), temporalPrediction);

const artifact = {
  version: "2026-09-11-temporal-ridge-v1",
  algorithm: "Ridge regression on log1p(yield) with Crop/State/Season one-hot features, normalized rainfall and per-hectare input rates, quadratic numeric terms, and crop-specific time trends",
  source: { url: SOURCE_URL, license: "CC BY 4.0", datasetPeriod: [1997, 2020], rows: rows.length },
  split: { train: [1997, 2017], validation: [2018, 2019], test: [2020], strategy: "chronological" },
  metrics: { validation: best.validation, temporalTest: temporalScore },
  trainingRows: rows.filter(r => r.year <= 2017).length,
  validationRows: validation.length,
  testRows: temporalTest.length,
  categories: { crops: encoder.crops, states: encoder.states, seasons: encoder.seasons },
  numeric: encoder.numeric,
  year: { mean: encoder.yearMean, sd: encoder.yearSd },
  lambda: best.lambda,
  weights: best.weights,
  target: "Yield (tonnes/hectare)",
  productionExcluded: true,
  areaRole: "used only to convert aggregate fertilizer/pesticide totals to per-hectare rates",
  createdAt: new Date().toISOString()
};

await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, JSON.stringify(artifact));
console.log(JSON.stringify({ rows: rows.length, validation: best.validation, temporalTest: temporalScore, output: OUT }, null, 2));
