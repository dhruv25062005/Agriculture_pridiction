# Agriculture Prediction Platform

An intelligent smart agriculture platform powered by **Google Gemini AI** for real-time plant disease detection, pest identification, and precision farming guidance. Upload leaf images to get instant diagnoses with organic/chemical treatment recommendations, fertilizer calculations, market pricing, and weather-based crop advisories.

## Features

- 🤖 **AI-Powered Disease Detection** – Google Gemini multimodal vision + agronomic fallback engine
- 📸 **Leaf Image Analysis** – Diagnose diseases, pests, and nutrient deficiencies instantly
- 💊 **Treatment Protocols** – Dual-mode recommendations (Organic/Chemical) with dosage details
- 📅 **IPM Recovery Plans** – Day-by-day integrated pest management protocols
- 🌾 **Crop Recommendations** – Temperature & rainfall-based crop selection
- 🧪 **Fertilizer Calculator** – Plot-sized NPK calculations with cost estimates
- 💰 **Profit Estimator** – Market-based revenue & ROI predictions
- 🌦️ **Smart Weather Advisories** – Spray safety & irrigation guidance
- 📊 **Scan History** – Track diagnostic records and treatment progress
- 🔐 **Firebase Authentication** – Secure user sessions and data persistence
- 📱 **Progressive Web App** – Offline-capable with service worker support

## Supported Crops & Conditions

**Crops:** Tomato, Potato, Pepper, Wheat, Rice, Maize, Cotton, Soybean, Onion

**Detects:**
- 20+ plant diseases (Late Blight, Early Blight, Bacterial Spot, Leaf Mold, etc.)
- 8+ insect pests (Fall Armyworm, Aphids, Whiteflies, Spider Mites, Leaf Miners, etc.)
- Viral infections & nutrient deficiencies
- Healthy plant status

## Tech Stack

- **Backend:** Node.js + Express 5.2
- **Frontend:** Vanilla JavaScript (HTML5/CSS3)
- **AI Engine:** Google Gemini API (multimodal vision)
- **Authentication:** Firebase + Cookie-based sessions
- **Storage:** In-memory (session history, scan journal)
- **APIs:** Open-Meteo, OpenWeatherMap, BigDataCloud (reverse geocode)
- **Deployment:** Render.com (with render.yaml config)

## Installation & Setup

### Prerequisites

- Node.js 18+
- npm or bun
- Google Gemini API key
- Firebase project credentials
- Modern web browser

### 1. Clone Repository

```bash
git clone https://github.com/dhruv25062005/Agriculture_pridiction.git
cd Agriculture_pridiction
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_DATABASE_URL=https://your_project.firebaseio.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=your_measurement_id

# Weather API (Optional - Open-Meteo is free fallback)
WEATHER_API_KEY=your_openweathermap_api_key
```

> **⚠️ Security:** Add `.env` to `.gitignore` before committing.

### 3. Run Development Server

```bash
npm run dev
# or
node server.js
```

The server starts at `http://localhost:3000`

### 4. Access Application

- **Landing Page:** `http://localhost:3000/` (Auth UI)
- **Dashboard:** `http://localhost:3000/signedin` (After login)
- **API Root:** `http://localhost:3000/` (Express server)

## API Endpoints

### Plant Disease Detection

**POST** `/predict`
- Upload leaf image → Get disease diagnosis with treatment plans
- Multipart form: `image` (file), `method` ("Chemical" | "Organic"), `lang` (language code)
- Response: Disease name, severity, confidence, treatments, protocols, prevention tips

### Scan History

**GET** `/scan_history`
- Retrieve last 20 diagnostic records

**POST** `/scan_history/delete`
- Delete scan record by ID

### Crop & Fertilizer Tools

**POST** `/recommend_crop`
- Input: `temp` (°C), `rainfall` (mm)
- Output: Recommended crop, season, yield, water requirement

**POST** `/plot_fertilizer`
- Input: `plot_size`, `unit`, `crop`, `pH`, `N`, `P`, `K`
- Output: Fertilizer bags (Urea/DAP/MOP), costs, pH advice, micronutrients

### Market & Profit

**GET** `/market_prices`
- Commodity prices in INR/USD with trends

**POST** `/calculate_profit`
- Input: `crop`, `acres`, `yield_per_acre`
- Output: Gross revenue, input costs, net profit, ROI %

### Weather & Smart Advisories

**GET** `/weather`
- Query: `city`, `lat`, `lon`, `place`
- Response: Temperature, humidity, wind, spray safety badge, irrigation status

### User & Session

**GET** `/api/user_session`
- Get current user profile

**POST** `/set_session`
- Update session data

**POST** `/api/update_profile`
- Input: `name`, `farmLocation`, `preferredLanguage`

## File Structure

```
.
├── server.js                      Main Express backend
├── package.json                   Dependencies & scripts
├── requirements.txt               Python equivalents (legacy)
├── render.yaml                    Render.com deployment config
├── firestore.rules                Firebase security rules
│
├── templates/
│   ├── template.html              Auth landing page
│   └── signedin.html              Main dashboard UI
│
├── static/
│   ├── manifest.json              PWA manifest
│   ├── sw.js                      Service worker (offline)
│   ├── js/                        Frontend JavaScript modules
│   ├── icons/                     PWA app icons
│   ├── smart_agri_hero.*          Hero banner images
│   └── smart_crop_scan.*          Feature images
│
├── model/
│   └── class_names.json           Disease class labels
│
└── README.md                      This file
```

## Key Implementation Features

### Gemini AI Fallback Strategy

If Gemini API is rate-limited, unavailable, or hits quota:
- Automatically switches to **hardcoded agronomic knowledge base**
- Contains 500+ lines of expert protocols for 20+ diseases/pests
- Provides identical JSON output structure (no user-facing disruption)

### Smart Weather Integration

- **Primary:** OpenWeatherMap API (if key provided)
- **Fallback 1:** Open-Meteo (free, no auth required)
- **Fallback 2:** Reverse geocoding + Open-Meteo
- **Fallback 3:** Hardcoded default values

### Treatment Recommendations

Each diagnosis includes:
1. **Chemical approach:** Specific active ingredients (e.g., Chlorantraniliprole, Mancozeb) with dosages
2. **Organic approach:** Bio-fungicides, botanical sprays, predatory insects with application rates
3. **Day-by-day IPM protocol:** Sequential 7-14 day action plan
4. **Prevention tips:** Long-term crop rotation, trap crops, resistant varieties

## Usage Examples

### Upload & Diagnose Leaf Disease

```javascript
const formData = new FormData();
formData.append("image", leafImageFile);
formData.append("method", "Organic"); // or "Chemical"
formData.append("lang", "en");

const response = await fetch("/predict", {
  method: "POST",
  body: formData
});

const diagnosis = await response.json();
console.log(diagnosis.disease, diagnosis.severity, diagnosis.organic_treatment);
```

### Get Fertilizer Recommendations

```javascript
const response = await fetch("/plot_fertilizer", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    plot_size: 1,
    unit: "acres",
    crop: "Tomato",
    pH: 6.5,
    N: 40,
    P: 25,
    K: 30
  })
});

const result = await response.json();
console.log(`Urea: ${result.urea_bags} bags, DAP: ${result.dap_bags} bags`);
console.log(`Total Cost: ₹${result.estimated_cost_inr}`);
```

### Check Weather & Spray Safety

```javascript
const response = await fetch("/weather?city=Delhi");
const weather = await response.json();

console.log(weather.spray_badge); // ✅ Safe to Spray or ❌ High Wind Drift Risk
console.log(weather.spray_window); // 6:30 AM - 9:30 AM or 4:30 PM - 7:00 PM
```

## Deployment

### Deploy to Render.com

1. Connect your GitHub repo to Render
2. Create a new Web Service
3. Use `render.yaml` for auto-configuration
4. Set environment variables in Render dashboard
5. Deploy

```yaml
services:
  - type: web
    name: agriculture-prediction
    runtime: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: GEMINI_API_KEY
        scope: build,runtime
      - key: FIREBASE_API_KEY
        scope: build,runtime
```

## Security Considerations

✅ **Environment Variables** – All sensitive keys in `.env` (never committed)
✅ **Firebase Rules** – Strict Firestore security policies
✅ **CORS & CSRF** – Enabled on Express middleware
✅ **Session Cookies** – HttpOnly, SameSite=None, Secure flags
✅ **Input Validation** – File size limits (30MB), string length caps
✅ **Rate Limiting** – Graceful degradation under high load

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `GEMINI_API_KEY not found` | Add `GEMINI_API_KEY` to `.env` and restart server |
| Gemini returns 401 errors | Key may be inactive; wait 2 hours after creation |
| Weather API returns null | OpenWeatherMap key invalid/inactive; app falls back to Open-Meteo |
| Port 3000 in use | Set `PORT` env var: `PORT=5000 npm start` |
| CORS errors on frontend | Ensure `credentials: true` in fetch requests |

## Performance Optimization

- **Compression:** gzip/deflate on all responses (512B threshold)
- **Caching:** 7-day browser cache for static assets, 1-hour for configs
- **Weather Cache:** 10-minute in-memory cache (max 200 entries)
- **Image Upload:** 30MB max file size with in-memory processing
- **Multimodal AI:** Lazy-loaded Gemini client only on first prediction

## Future Enhancements

- [ ] Real-time disease severity trending
- [ ] Soil moisture & humidity sensor integration
- [ ] Multi-language treatment protocols
- [ ] Mobile app with push notifications
- [ ] Historical yield analytics & ML predictions
- [ ] Integration with agricultural mandi marketplaces
- [ ] Drone image batch processing

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m "Add your feature"`
4. Push to branch: `git push origin feature/your-feature`
5. Submit a Pull Request

## License

This project is open source. See LICENSE file for details.

## Support & Feedback

- **Report Issues:** [GitHub Issues](https://github.com/dhruv25062005/Agriculture_pridiction/issues)
- **Discussions:** [GitHub Discussions](https://github.com/dhruv25062005/Agriculture_pridiction/discussions)
- **Email:** dhruv25062005@github.com

## Acknowledgments

- Google Gemini API for multimodal AI vision
- Firebase for authentication & real-time services
- Open-Meteo for free weather data
- Agricultural expertise from plant pathology research

---

**Last Updated:** September 2026 | **Version:** 1.0.0
