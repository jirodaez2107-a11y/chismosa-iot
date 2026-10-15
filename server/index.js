const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// Simple in-memory device/template info
const DEVICE = {
  id: 'ash-bahay',
  templateId: 'TEMPLATE_NOISE_001',
  deviceName: 'ash bahay',
  model: 'ESP8266',
  sensor: 'Primary sound sensor',
  firmware: 'v1.0.0',
  pin: 'V0',
  location: 'jiro',
  wifi: { ssid: 'your-ssid', status: 'connected' },
  authToken: 'chismosa_live_tok_wms1mlrqcwogfk',
  status: 'offline',
  lastSeen: null,
};

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve built frontend if present
const path = require('path');
const publicDir = path.join(__dirname, 'public');
if (require('fs').existsSync(publicDir)) {
  app.use(express.static(publicDir));
  // fallback to index.html for SPA
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// Broadcast helper
function broadcast(data) {
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

function publishTelemetry(pin, numericValue) {
  const normalizedPin = String(pin).trim().toUpperCase();
  const isV0 = normalizedPin === 'V0';
  const isRawV0 = isV0 && numericValue > 100;
  const displayValue = isRawV0
    ? Number((40 + (Math.min(1024, Math.max(0, numericValue)) / 1024) * 80).toFixed(1))
    : numericValue;

  DEVICE.status = 'online';
  DEVICE.wifi.status = 'connected';
  DEVICE.lastSeen = Date.now();
  const data = {
    type: 'update',
    payload: {
      pin: normalizedPin,
      value: displayValue,
      ...(isRawV0 ? { rawValue: numericValue } : {}),
      ...(isV0 ? { unit: 'dB' } : {}),
      ts: DEVICE.lastSeen,
      status: DEVICE.status,
      lastSeen: DEVICE.lastSeen,
      deviceName: DEVICE.deviceName,
      device: DEVICE,
    },
  };
  broadcast(data);
  return data;
}

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('Client connected');
  // send device info on connect
  ws.send(JSON.stringify({ type: 'device', payload: DEVICE }));

  ws.on('message', (msg) => {
    console.log('Received ws message:', msg.toString());
  });
});

const heartbeatInterval = setInterval(() => {
  const now = Date.now();
  if (DEVICE.lastSeen && now - DEVICE.lastSeen > 15000) {
    DEVICE.status = 'offline';
    DEVICE.wifi.status = 'disconnected';
  }
  broadcast({ type: 'heartbeat', payload: { ts: now, device: DEVICE } });
}, 5000);

// REST: get device info
app.get('/api/device', (req, res) => res.json(DEVICE));

app.patch('/api/device/name', (req, res) => {
  const token = req.body.token;
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!token || token !== DEVICE.authToken) return res.status(401).json({ error: 'invalid token' });
  if (!name) return res.status(400).json({ error: 'device name required' });

  DEVICE.deviceName = name;
  broadcast({ type: 'device', payload: DEVICE });
  return res.json({ ok: true, device: DEVICE });
});

// REST: accept updates like Blynk
// POST /api/v1/update?token=YOUR_AUTH_TOKEN&pin=V0&value=120
app.post('/api/v1/update', (req, res) => {
  const token = req.query.token ?? req.body.token;
  const pin = req.query.pin ?? req.body.pin;
  const value = req.query.value ?? req.body.value;

  if (!token || token !== DEVICE.authToken) {
    return res.status(401).json({ error: 'invalid token' });
  }
  if (!pin || typeof value === 'undefined') {
    return res.status(400).json({ error: 'pin and value required' });
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return res.status(400).json({ error: 'value must be a finite number' });
  }

  const data = publishTelemetry(pin, numericValue);
  return res.json({ ok: true, data });
});

// Simple mock generator
let mockInterval = null;
app.post('/api/mock/start', (req, res) => {
  const token = req.query.token || req.body.token;
  if (!token || token !== DEVICE.authToken) return res.status(401).json({ error: 'invalid token' });
  if (mockInterval) return res.json({ ok: true, message: 'mock already running' });

  function emitOnce() {
    const noise = Math.round(20 + Math.random() * 80 * Math.random() * 5); // 0-500 scale approximated
    publishTelemetry('V0', noise);
    // schedule next 1-2s
    const delay = 1000 + Math.round(Math.random() * 1000);
    mockInterval = setTimeout(emitOnce, delay);
  }

  emitOnce();
  return res.json({ ok: true, message: 'mock started' });
});

app.post('/api/mock/stop', (req, res) => {
  const token = req.query.token || req.body.token;
  if (!token || token !== DEVICE.authToken) return res.status(401).json({ error: 'invalid token' });
  if (mockInterval) {
    clearTimeout(mockInterval);
    mockInterval = null;
  }
  return res.json({ ok: true, message: 'mock stopped' });
});

// Code generator endpoint
app.get('/api/generate', (req, res) => {
  const auth = req.query.auth || req.query.token;
  const templateId = req.query.templateId || 'TEMPLATE_NOISE_001';
  const deviceName = req.query.deviceName || 'MyNoiseDevice';

  if (!auth || auth !== DEVICE.authToken) return res.status(401).send('invalid token');

  const code = `#include <ESP8266WiFi.h>\n#include <BlynkSimpleEsp8266.h>\n\n#define BLYNK_TEMPLATE_ID "${templateId}"\n#define BLYNK_AUTH_TOKEN "${DEVICE.authToken}"\n\nchar ssid[] = "YOUR_SSID";\nchar pass[] = "YOUR_PASS";\n\nvoid setup() {\n  Serial.begin(115200);\n  WiFi.begin(ssid, pass);\n  Blynk.begin(BLYNK_AUTH_TOKEN, ssid, pass);\n}\n\nvoid loop() {\n  float noise = analogRead(A0); // replace with actual sensor code\n  Blynk.virtualWrite(V0, noise);\n  Blynk.run();\n  delay(1500);\n}\n`;

  res.setHeader('Content-Type', 'text/plain');
  res.send(code);
});

// Serve a tiny status page at root
app.get('/', (req, res) => {
  res.send(`<h3>IoT Dashboard backend</h3><p>WebSocket connected clients: ${wss.clients.size}</p>`);
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
