# ==========================================
# Plant Disease Detection Training Script
# HOG + SVM (NO TensorFlow)
# ==========================================

import os
import cv2
import numpy as np
import json
from skimage.feature import hog
from sklearn.svm import SVC
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from joblib import dump

# ===============================
# CONFIG
# ===============================
DATASET_PATH = "PlantVillage"
IMG_SIZE = 96
MODEL_DIR = "model"
MODEL_PATH = os.path.join(MODEL_DIR, "disease_model.pkl")
LABEL_PATH = os.path.join(MODEL_DIR, "class_names.json")

os.makedirs(MODEL_DIR, exist_ok=True)

# ===============================
# FEATURE EXTRACTION
# ===============================
def extract_features(image_path):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError("Invalid image")

    img = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    features = hog(
        gray,
        orientations=9,
        pixels_per_cell=(8, 8),
        cells_per_block=(2, 2),
        block_norm="L2-Hys"
    )
    return features

# ===============================
# LOAD DATASET
# ===============================
X, y = [], []
class_names = []

print("📂 Loading dataset...")

for idx, folder in enumerate(sorted(os.listdir(DATASET_PATH))):
    folder_path = os.path.join(DATASET_PATH, folder)

    if not os.path.isdir(folder_path):
        continue

    class_names.append(folder)
    print(f"➡️ Processing: {folder}")

    for img_name in os.listdir(folder_path):
        img_path = os.path.join(folder_path, img_name)

        if not os.path.isfile(img_path):
            continue

        try:
            features = extract_features(img_path)
            X.append(features)
            y.append(idx)
        except:
            continue

X = np.array(X)
y = np.array(y)

print("✅ Dataset loaded")
print("📊 Samples:", len(X))
print("🏷️ Classes:", len(class_names))

# ===============================
# TRAIN / TEST SPLIT
# ===============================
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, stratify=y, random_state=42
)

# ===============================
# TRAIN MODEL
# ===============================
print("🚀 Training SVM model...")

model = SVC(kernel="linear", probability=True)
model.fit(X_train, y_train)

# ===============================
# EVALUATION
# ===============================
accuracy = accuracy_score(y_test, model.predict(X_test))
print(f"🎯 Accuracy: {accuracy * 100:.2f}%")

# ===============================
# SAVE MODEL
# ===============================
dump(model, MODEL_PATH)

with open(LABEL_PATH, "w") as f:
    json.dump(class_names, f, indent=4)

print("✅ Model saved to:", MODEL_PATH)
print("✅ Labels saved to:", LABEL_PATH)
