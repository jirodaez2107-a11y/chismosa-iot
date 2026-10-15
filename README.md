# IoT Dashboard (Noise Monitor) — Scaffold

This repository is a starter full-stack IoT Dashboard inspired by Blynk.cloud.

Overview
- Backend: Node.js + Express + WebSocket (mock data generator, REST endpoints)
- Frontend: React + Vite + Tailwind CSS + Chart.js

Quick start (requires Node.js 18+ and npm)

1. Install dependencies

```bash
cd server
npm install
cd ../client
npm install
```

2. Run backend

```bash
cd server
npm start
# server listens on http://localhost:3000
```

3. Run frontend (dev)

```bash
cd client
npm run dev
# open http://localhost:5173
```

Firebase setup

1. Create a Firebase project at https://console.firebase.google.com.
2. Enable Authentication > Sign-in method > Email/Password.
3. Create a Firestore database in production or test mode.
4. Copy `client/.env.example` to `client/.env.local` and fill in the Firebase Web App values.
5. Restart Vite after changing environment variables.

The app uses Firebase Authentication for sign-in/sign-up and `onAuthStateChanged` for sessions. Firestore stores each user's profile at `users/{uid}` and dashboard settings at `users/{uid}/settings/chismosa`, including datastreams and widget configurations. Firestore listeners keep settings synchronized across open clients.

Recommended Firestore rules for this app:

```text
rules_version = '2';
service cloud.firestore {
	match /databases/{database}/documents {
		match /users/{userId} {
			allow read, write: if request.auth != null && request.auth.uid == userId;
			match /settings/{document} {
				allow read, write: if request.auth != null && request.auth.uid == userId;
			}
		}
	}
}
```

Features
- Live WebSocket updates for sensor data
- REST endpoint to receive sensor updates: `POST /api/v1/update?token=TOKEN&pin=V0&value=123`
- Mock Data Generator (start/stop via REST)
- Client-side dashboard with Gauge, Time-series chart, Device Info, and Data Stream config
- Code export endpoint: `GET /api/generate?templateId=...&auth=...&deviceName=...`

Files of interest
- [server/index.js](server/index.js)
- [client/src/App.jsx](client/src/App.jsx)

License: MIT (scaffold)
