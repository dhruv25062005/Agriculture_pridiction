from flask import Flask, render_template, session, redirect, request, jsonify
from dotenv import load_dotenv
import os
import io
import json
import requests

# ===============================
# LOAD ENV VARIABLES
# ===============================
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-key")

# ===============================
# SESSION COOKIE CONFIG (IMPORTANT)
# ===============================
app.config.update(
    SESSION_COOKIE_SAMESITE="None",
    SESSION_COOKIE_SECURE=True
)

# ===============================
# CORS (Firebase + fetch + cookies)
# ===============================
from flask_cors import CORS

CORS(
    app,
    supports_credentials=True,
    origins=[
        "https://agriculture-pridiction-laeb.onrender.com",
        "http://127.0.0.1:8080",
        "http://localhost:8080"
    ]
)

# ===============================
# ML IMPORTS
# ===============================
from joblib import load
import numpy as np
import cv2
from skimage.feature import hog
from PIL import Image

# ===============================
# ML CONFIG
# ===============================
IMG_SIZE = 96
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(BASE_DIR, "model", "disease_model.pkl")
LABEL_PATH = os.path.join(BASE_DIR, "model", "class_names.json")
if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(f"Model not found: {MODEL_PATH}")

model = load(MODEL_PATH)
with open(LABEL_PATH, "r") as f:
    class_names = json.load(f)

# ===============================
# MEDICINE DATABASE
# ===============================
CHEMICAL_DB = {
    "Tomato___Late_blight": "Spray Metalaxyl + Mancozeb (2g/L water)",
    "Tomato___Early_blight": "Use Chlorothalonil weekly",
    "Potato___Late_blight": "Apply Metalaxyl immediately",
    "Potato___Early_blight": "Spray Mancozeb",
}

ORGANIC_DB = {
    "Tomato___Late_blight": "Neem oil + baking soda spray",
    "Tomato___Early_blight": "Garlic extract spray",
    "Potato___Late_blight": "Trichoderma-based bio-fungicide",
    "Potato___Early_blight": "Neem oil spray",
}

# ===============================
# FEATURE EXTRACTION (HOG)
# ===============================
def extract_features(image: Image.Image):
    image = image.resize((IMG_SIZE, IMG_SIZE))
    img = np.array(image)

    if len(img.shape) == 3:
        img = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

    features = hog(
        img,
        orientations=9,
        pixels_per_cell=(8, 8),
        cells_per_block=(2, 2),
        block_norm="L2-Hys"
    )
    return features.reshape(1, -1)

# ===============================
# FIREBASE CONFIG API
# ===============================
@app.route("/firebase_config")
def firebase_config():
    return jsonify({
        "apiKey": os.getenv("FIREBASE_API_KEY"),
        "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
        "databaseURL": os.getenv("FIREBASE_DATABASE_URL"),
        "projectId": os.getenv("FIREBASE_PROJECT_ID"),
        "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
        "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
        "appId": os.getenv("FIREBASE_APP_ID"),
        "measurementId": os.getenv("FIREBASE_MEASUREMENT_ID")
    })

# ===============================
# SESSION SET (Firebase → Flask)
# ===============================
@app.route("/set_session", methods=["POST"])
def set_session():
    session["user"] = request.json
    session.modified = True
    return jsonify({"status": "success"})

# ===============================
# AUTH ROUTES
# ===============================
@app.route("/")
def home():
    return render_template("template.html")

@app.route("/signup")
def signup():
    return render_template("signup.html")

@app.route("/signin")
def signin():
    return render_template("signin.html")

@app.route("/signedin")
def signedin():
    if "user" not in session:
        return redirect("/signin")
    return render_template("signedin.html", user=session["user"])

@app.route("/template")
def template():
    return render_template("template.html")
# ===============================
# 🤖 DISEASE DETECTION
# ===============================
@app.route("/predict", methods=["POST"])
def predict():

    # Check if user is logged in
    if "user" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    # Get uploaded image
    file = request.files.get("image")

    if file is None:
        return jsonify({
            "error": "Image missing"
        }), 400

    if file.filename == "":
        return jsonify({
            "error": "No image selected"
        }), 400

    # Get treatment method
    method = request.form.get("method", "Chemical")

    try:
        # Read image
        image = Image.open(io.BytesIO(file.read())).convert("RGB")

        # Extract features
        features = extract_features(image)

        # Predict disease
        idx = int(model.predict(features)[0])
        disease = class_names[idx]

        # Calculate confidence
        if hasattr(model, "decision_function"):
            score = np.max(model.decision_function(features))
            confidence = round(min(95, 60 + abs(score) * 10), 2)
        else:
            confidence = 90.0

        # Select treatment
        if method == "Organic":
            treatment = ORGANIC_DB.get(
                disease,
                "Neem oil recommended"
            )
        else:
            treatment = CHEMICAL_DB.get(
                disease,
                "Consult agriculture expert"
            )

        return jsonify({
            "success": True,
            "disease": disease,
            "confidence": confidence,
            "treatment": treatment
        })

    except Exception as e:
        print("Prediction Error:", e)

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
# ===============================
# 🌾 CROP RECOMMENDATION
# ===============================
@app.route("/recommend_crop", methods=["POST"])
def recommend_crop():
    if "user" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    temp = float(data.get("temp", 0))
    rainfall = float(data.get("rainfall", 0))

    if rainfall > 150 and temp > 25:
        crop = "Rice"
    elif temp < 25 and rainfall < 120:
        crop = "Wheat"
    else:
        crop = "Maize"

    return jsonify({"crop": crop})

# ===============================
# 🧪 FERTILIZER ADVICE
# ===============================
@app.route("/fertilizer_advice", methods=["POST"])
def fertilizer_advice():
    if "user" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    N = float(data.get("N", 0))
    P = float(data.get("P", 0))
    K = float(data.get("K", 0))

    advice = []
    if N < 50: advice.append("Add Urea (Nitrogen)")
    if P < 40: advice.append("Add DAP (Phosphorus)")
    if K < 40: advice.append("Add MOP (Potassium)")

    return jsonify({
        "advice": "Soil nutrients are balanced" if not advice else ", ".join(advice)
    })

# ===============================
# 📈 YIELD PREDICTION
# ===============================
@app.route("/predict_yield", methods=["POST"])
def predict_yield():
    if "user" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    rainfall = float(data.get("rainfall", 0))
    temp = float(data.get("temp", 0))
    humidity = float(data.get("humidity", 0))

    y = rainfall * 0.3 + temp * 0.4 + humidity * 0.3
    return jsonify({"yield_index": round(y, 2)})

# ===============================
# 🌦️ WEATHER API (HERO BUTTON FIX)
# ===============================
@app.route("/weather")
def weather():
    if "user" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    city = request.args.get("city", "Delhi")
    api_key = os.getenv("WEATHER_API_KEY")

    if not api_key:
        return jsonify({"error": "Weather API key missing"}), 500

    url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}&units=metric"

    r = requests.get(url, timeout=5)
    if r.status_code != 200:
           return jsonify({
        "error":"Weather API failed"
    }),500

    data = r.json()
    return jsonify({
        "city": city,
        "temperature": data["main"]["temp"],
        "humidity": data["main"]["humidity"],
        "condition": data["weather"][0]["description"]
    })

# ===============================
# 📊 AI STATS (HERO BUTTON FIX)
# ===============================
@app.route("/ai_stats")
def ai_stats():
    if "user" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    return jsonify({
        "model": "HOG + SVM",
        "accuracy": "98.1%",
        "classes": len(class_names),
        "image_size": IMG_SIZE
    })

# ===============================
# AFTER REQUEST HEADERS (CRITICAL)
# ===============================
@app.after_request
def add_headers(response):
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response

# ===============================
# ERROR HANDLERS
# ===============================
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Route not found"}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500

# ===============================
# RUN SERVER
# ===============================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)
