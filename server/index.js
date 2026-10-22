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

const devices = new Map();

function createDevice(authToken) {
  const shortToken = authToken.slice(-6);
  return {
    id: `device-${shortToken}`,
    templateId: 'TEMPLATE_NOISE_001',
    deviceName: `ESP8266-${shortToken}`,
    model: 'ESP8266',
    sensor: 'Primary sound sensor',
    firmware: 'v1.0.0',
    pin: 'V0',
    location: '',
    wifi: { ssid: 'your-ssid', status: 'disconnected' },
    authToken,
    status: 'offline',
    lastSeen: null,
    totalReadings: 0,
    lastReading: null,
    uptimeStartedAt: null,
    onlineSince: null,
    accumulatedOnlineMs: 0,
    hardwareConnections: new Set(),
  };
}

function getDevice(authToken) {
  if (!devices.has(authToken)) devices.set(authToken, createDevice(authToken));
  return devices.get(authToken);
}

function getRequestToken(req) {
  const authorization = req.headers.authorization;
  let token = req.headers['x-auth-token'] ||
    req.query.token ||
    req.body?.token ||
    (authorization && authorization.replace('Bearer ', ''));
  if (typeof token === 'string') token = token.trim();
  return token;
}

function findDeviceByToken(token) {
  if (typeof token !== 'string') return null;
  const normalizedToken = token.toLowerCase();
  for (const device of devices.values()) {
    if (device.authToken.toLowerCase() === normalizedToken) return device;
  }
  return null;
}

function authenticateDevice(req, res, next) {
  const token = getRequestToken(req);
  const device = findDeviceByToken(token);
  if (!device) {
    console.log('Received invalid token:', token);
    return res.status(401).json({ error: 'invalid token' });
  }
  req.device = device;
  next();
}

function serializeDevice(device, now = Date.now()) {
  const { hardwareConnections, ...publicDevice } = device;
  return {
    ...publicDevice,
    token: device.authToken,
    onlineConnections: hardwareConnections.size,
    uptimePercentage: getDeviceUptime(device, now),
  };
}

function getDeviceUptime(device, now = Date.now()) {
  const elapsedMs = device.uptimeStartedAt ? Math.max(0, now - device.uptimeStartedAt) : 0;
  const onlineMs = device.accumulatedOnlineMs + (device.onlineSince ? Math.max(0, now - device.onlineSince) : 0);
  return elapsedMs ? Number(Math.min(100, (onlineMs / elapsedMs) * 100).toFixed(1)) : 0;
}

function getMetrics(now = Date.now()) {
  const list = [...devices.values()];
  const totalReadings = list.reduce((sum, device) => sum + device.totalReadings, 0);
  const onlineDevices = list.filter((device) => device.status === 'online');
  const uptimePercentage = list.length
    ? Number((list.reduce((sum, device) => sum + getDeviceUptime(device, now), 0) / list.length).toFixed(1))
    : 0;
  return {
    totalReadings,
    uptimePercentage,
    healthStatus: onlineDevices.length ? 'online' : 'offline',
    onlineDeviceCount: onlineDevices.length,
    registeredDeviceCount: list.filter((device) => device.lastSeen || device.hardwareConnections.size).length,
    devices: list.map((device) => serializeDevice(device, now)),
    updatedAt: now,
  };
}

function markHardwareConnected(device, ws, now = Date.now()) {
  const wasOffline = device.hardwareConnections.size === 0;
  device.hardwareConnections.add(ws);
  if (!device.uptimeStartedAt) device.uptimeStartedAt = now;
  if (wasOffline) device.onlineSince = now;
  device.status = 'online';
  device.wifi.status = 'connected';
  device.lastSeen = now;
}

function markHardwareDisconnected(device, ws, now = Date.now()) {
  device.hardwareConnections.delete(ws);
  if (device.hardwareConnections.size > 0) return;
  if (device.onlineSince) {
    device.accumulatedOnlineMs += Math.max(0, now - device.onlineSince);
    device.onlineSince = null;
  }
  device.status = 'offline';
  device.wifi.status = 'disconnected';
}

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

function publishTelemetry(device, pin, numericValue) {
  device.totalReadings += 1;
  device.lastReading = numericValue;
  const normalizedPin = String(pin).trim().toUpperCase();
  const isV0 = normalizedPin === 'V0';
  const isRawV0 = isV0 && numericValue > 100;
  const displayValue = isRawV0
    ? Number((40 + (Math.min(1024, Math.max(0, numericValue)) / 1024) * 80).toFixed(1))
    : numericValue;

  device.status = 'online';
  device.wifi.status = 'connected';
  device.lastSeen = Date.now();
  const data = {
    type: 'update',
    payload: {
      pin: normalizedPin,
      value: displayValue,
      ...(isRawV0 ? { rawValue: numericValue } : {}),
      ...(isV0 ? { unit: 'dB' } : {}),
      ts: device.lastSeen,
      status: device.status,
      lastSeen: device.lastSeen,
      deviceName: device.deviceName,
      device: serializeDevice(device, device.lastSeen),
      metrics: getMetrics(device.lastSeen),
    },
  };
  broadcast(data);
  return data;
}

// WebSocket connection
wss.on('connection', (ws, req) => {
  const query = new URL(req.url, 'http://localhost').searchParams;
  const clientType = query.get('clientType');
  const deviceToken = query.get('deviceToken');
  const isHardware = clientType === 'hardware';
  const device = isHardware && deviceToken ? getDevice(deviceToken) : null;
  console.log(`${isHardware ? 'Hardware' : 'Web'} client connected`);

  if (device) {
    markHardwareConnected(device, ws);
    ws.send(JSON.stringify({ type: 'device', payload: serializeDevice(device) }));
    broadcast({
      type: 'lifecycle',
      payload: {
        kind: 'connected',
        message: 'WebSocket connection established',
        deviceName: device.deviceName,
        ts: device.lastSeen,
        deviceToken: device.authToken,
        metrics: getMetrics(device.lastSeen),
      },
    });
  } else if (getMetrics().registeredDeviceCount) {
    ws.send(JSON.stringify({ type: 'metrics', payload: getMetrics() }));
  }

  ws.on('message', (msg) => {
    console.log('Received ws message:', msg.toString());
  });

  ws.on('close', () => {
    if (!device) return;
    const disconnectedAt = Date.now();
    markHardwareDisconnected(device, ws, disconnectedAt);
    broadcast({
      type: 'lifecycle',
      payload: {
        kind: 'disconnected',
        message: 'WebSocket connection lost',
        deviceName: device.deviceName,
        deviceToken: device.authToken,
        ts: disconnectedAt,
        metrics: getMetrics(disconnectedAt),
      },
    });
  });
});

const heartbeatInterval = setInterval(() => {
  const now = Date.now();
  devices.forEach((device) => {
    if (device.hardwareConnections.size === 0 && device.lastSeen && now - device.lastSeen > 15000) {
      device.status = 'offline';
      device.wifi.status = 'disconnected';
    }
  });
  broadcast({ type: 'heartbeat', payload: { ts: now, metrics: getMetrics(now), devices: [...devices.values()].map((device) => serializeDevice(device, now)) } });
}, 5000);

// REST: get device info
app.get('/api/device', (req, res) => {
  const token = req.query.token;
  if (token) return res.json(serializeDevice(getDevice(token)));
  return res.json({ devices: [...devices.values()].map((device) => serializeDevice(device)) });
});
app.get('/api/metrics', (req, res) => res.json(getMetrics()));

app.delete('/api/device', (req, res) => {
  const token = getRequestToken(req);
  const device = findDeviceByToken(token);
  if (!device) return res.status(404).json({ error: 'device not found' });

  device.hardwareConnections.forEach((connection) => connection.close());
  devices.delete(device.authToken);
  if (mockIntervals.has(device.authToken)) {
    clearTimeout(mockIntervals.get(device.authToken));
    mockIntervals.delete(device.authToken);
  }
  broadcast({ type: 'metrics', payload: getMetrics() });
  return res.json({ success: true, message: 'Device deleted' });
});

app.patch('/api/device/name', (req, res) => {
  const token = req.body.token;
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!token || !devices.has(token)) return res.status(401).json({ error: 'invalid token' });
  if (!name) return res.status(400).json({ error: 'device name required' });

  const device = getDevice(token);
  device.deviceName = name;
  broadcast({ type: 'device', payload: serializeDevice(device) });
  return res.json({ ok: true, device: serializeDevice(device) });
});

// REST: accept updates like Blynk
// POST /api/v1/update?token=YOUR_AUTH_TOKEN&pin=V0&value=120
app.post('/api/v1/update', (req, res) => {
  console.log('[B.U.L.A.B.O.G Hardware Sync] Data received successfully:', req.body || req.query);
  return res.status(200).json({
    success: true,
    message: 'Telemetry received',
    data: req.body || req.query,
  });
});

// Simple mock generator
const mockIntervals = new Map();
app.post('/api/mock/start', (req, res) => {
  const token = req.query.token || req.body.token;
  if (!token) return res.status(401).json({ error: 'invalid token' });
  if (mockIntervals.has(token)) return res.json({ ok: true, message: 'mock already running' });

  function emitOnce() {
    const noise = Math.round(20 + Math.random() * 80 * Math.random() * 5); // 0-500 scale approximated
    publishTelemetry(getDevice(token), 'V0', noise);
    // schedule next 1-2s
    const delay = 1000 + Math.round(Math.random() * 1000);
    mockIntervals.set(token, setTimeout(emitOnce, delay));
  }

  emitOnce();
  return res.json({ ok: true, message: 'mock started' });
});

app.post('/api/mock/stop', (req, res) => {
  const token = req.query.token || req.body.token;
  if (!token) return res.status(401).json({ error: 'invalid token' });
  if (mockIntervals.has(token)) {
    clearTimeout(mockIntervals.get(token));
    mockIntervals.delete(token);
  }
  return res.json({ ok: true, message: 'mock stopped' });
});

// Code generator endpoint
app.get('/api/generate', (req, res) => {
  const auth = req.query.auth || req.query.token;
  const templateId = req.query.templateId || 'TEMPLATE_NOISE_001';
  const deviceName = req.query.deviceName || 'MyNoiseDevice';

  if (!auth || !devices.has(auth)) return res.status(401).send('invalid token');

  const code = `#include <ESP8266WiFi.h>\n#include <BlynkSimpleEsp8266.h>\n\n#define BLYNK_TEMPLATE_ID "${templateId}"\n#define BLYNK_AUTH_TOKEN "${auth}"\n\nchar ssid[] = "YOUR_SSID";\nchar pass[] = "YOUR_PASS";\n\nvoid setup() {\n  Serial.begin(115200);\n  WiFi.begin(ssid, pass);\n  Blynk.begin(BLYNK_AUTH_TOKEN, ssid, pass);\n}\n\nvoid loop() {\n  float noise = analogRead(A0); // replace with actual sensor code\n  Blynk.virtualWrite(V0, noise);\n  Blynk.run();\n  delay(1500);\n}\n`;

  res.setHeader('Content-Type', 'text/plain');
  res.send(code);
});

// Serve a tiny status page at root
app.get('/', (req, res) => {
  res.send(`<h3>IoT Dashboard backend</h3><p>WebSocket connected clients: ${wss.clients.size}</p>`);
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
