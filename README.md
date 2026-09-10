# Agriculture Prediction Platform

A smart-agriculture web application using **Node.js, Express, Firebase Authentication, Google Gemini vision, and Open-Meteo**. It provides plant-image analysis, weather data, crop recommendations, fertilizer/profit tools, and an authenticated farmer dashboard.

## What the application does

- **Plant diagnosis:** Gemini multimodal analysis of uploaded JPEG/PNG/WebP images. The system does not invent a local fallback diagnosis when AI is unavailable.
- **Crop recommendation:** temperature/rainfall suitability scoring. This is an advisory score, not a validated agronomic yield model.
- **Weather:** live Open-Meteo current/hourly/7-day forecast data. Invalid locations and upstream failures return errors instead of fabricated weather values.
- **Authentication:** Firebase Authentication on the client with Firebase Admin-verified server sessions in HttpOnly cookies.
- **Scan history:** authenticated users only; diagnostic records are isolated by Firebase UID in the runtime session layer.
- **PWA:** static assets may be cached, while authenticated pages and application/API responses are not cached by the service worker.

## Tech stack

- Backend: Node.js 20+ / Express 5
- Frontend: HTML, CSS, vanilla JavaScript
- AI: Google Gemini API
- Authentication: Firebase Auth + Firebase Admin session cookies
- Database: Firestore where configured by the Firebase project
- Weather: Open-Meteo
- Security: Helmet, CORS allow-list, rate limiting, validation, signed/verified sessions, upload signature checks
- Deployment: Render

## Run locally

```bash
npm install
npm run dev
```

Production:

```bash
npm start
```

Validation:

```bash
npm test
```

`npm test` currently performs JavaScript syntax validation across the server, security, validation, logger, and runtime-hardening modules.

## Environment variables

At minimum configure the services your deployment uses:

```env
GEMINI_API_KEY=your_gemini_api_key
FIREBASE_API_KEY=your_firebase_web_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_bucket
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_CLIENT_EMAIL=your_service_account_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
SESSION_SECRET=use-a-long-random-secret
CORS_ORIGINS=https://your-production-domain.example
FIREBASE_FIRESTORE_DATABASE_ID=(default)
```

Do **not** commit `.env` or service-account credentials.

## Main API routes

| Method | Route | Purpose |
|---|---|---|
| POST | `/predict` | Authenticated plant-image diagnosis |
| GET | `/weather` | Live weather/forecast by city or coordinates |
| POST | `/recommend_crop` | Climate-based crop recommendation |
| POST | `/predict_yield` | Environmental suitability index, not validated yield prediction |
| POST | `/plot_fertilizer` | Fertilizer calculation |
| POST | `/calculate_profit` | Profit calculation |
| GET | `/scan_history` | Current user's diagnostic history |
| POST | `/scan_history/delete` | Clear current user's history |
| GET | `/api/user_session` | Current authenticated profile |
| POST | `/api/update_profile` | Update authenticated profile |
| POST | `/set_session` | Exchange a verified Firebase ID token for a server session |

Protected routes require a valid Firebase-authenticated session. Guest users are not silently created for protected APIs.

## Image upload safety

Plant diagnosis accepts only JPEG, PNG, and WebP images. Uploads are size-limited and checked against their binary file signatures rather than trusting only the filename or MIME type.

## AI diagnosis safety

The AI prompt explicitly instructs Gemini not to guess when an image is unclear or not a plant. If Gemini is unavailable, the API returns a service-unavailable response rather than selecting an arbitrary disease. Confidence is reported only when the model provides a numeric value and is not presented as independently validated accuracy.

Chemical-treatment information is advisory only. Users should follow locally registered crop-specific product labels and applicable agricultural guidance rather than relying on an automatically generated dosage.

## Weather behavior

Weather requests are resolved from the supplied city/place or valid latitude/longitude. The application uses Open-Meteo directly for the live response. There is no hardcoded temperature/humidity/wind fallback, so an upstream failure is visible to the client instead of being presented as real weather.

## Security notes

- Firebase Admin verifies authentication tokens/session cookies.
- Session cookies are HttpOnly and Secure in production.
- CORS is allow-listed through environment configuration.
- Helmet security headers and rate limiting are enabled.
- Authenticated responses are marked `no-store` where appropriate.
- The service worker caches static resources only; it does not cache authenticated dashboard/API responses.
- Uploads use memory storage with strict size and file-signature validation.

## Limitations

The crop/yield, fertilizer, and profit tools are decision-support utilities. They are not a substitute for field testing, soil laboratory analysis, local agricultural extension advice, or independently validated ML yield models. Market values should be treated as estimates unless connected to a verified live market feed.

## Deployment

The project is configured for Render. Set all required environment variables in the Render service, then deploy from `main`. After deployment, verify:

1. Firebase email/Google sign-in.
2. `/api/user_session` after login.
3. `/weather?city=Agra` with a real response.
4. `/predict` with a real plant image.
5. Scan history isolation using two separate test accounts.
6. Logout/session invalidation.

## License

This project is open source. See the repository for the current license and source code.

**Last updated:** September 2026
