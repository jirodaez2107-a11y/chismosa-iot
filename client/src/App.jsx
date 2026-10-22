import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Box,
  ChevronDown,
  Code2,
  Copy,
  Database,
  Eye,
  EyeOff,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  Mail,
  MapPin,
  Pencil,
  Play,
  Plus,
  Radio,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  LogOut,
  Sparkles,
  Trash2,
  User,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "./auth/useAuth";
import { useFirestoreSettings } from "./data/useFirestoreSettings";
import { useWebSocket, WebSocketProvider } from "./data/WebSocketContext";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./styles/index.css";

const tabs = [
  "Home",
  "Datastreams",
  "Web Dashboard",
  "Automation Templates",
  "Metadata",
  "Connection Lifecycle",
  "Events & Notifications",
];
const nav = [
  ["Developer Zone", Code2],
  ["Devices", Radio],
];
const initialWidgets = [
  {
    id: "gauge",
    kind: "gauge",
    title: "Noise Level",
    pin: "V0",
    min: 0,
    max: 120,
  },
  {
    id: "chart",
    kind: "chart",
    title: "Noise History",
    pin: "V0",
    min: 0,
    max: 120,
  },
];
const widgetTypes = [
  ["value", "Value Box", "Live numeric value", Box],
  ["gauge", "Semi-circular Gauge", "Noise meter", Gauge],
  ["radial", "Radial Gauge", "Circular meter", Activity],
  ["chart", "Chart", "Historical data", LineChart],
];
const defaultStreams = [
  {
    id: 1,
    pin: "V0",
    name: "Noise Level",
    type: "Double",
    min: 0,
    max: 120,
    unit: "dB",
  },
  {
    id: 2,
    pin: "V1",
    name: "Peak Noise",
    type: "Integer",
    min: 0,
    max: 120,
    unit: "dB",
  },
  {
    id: 3,
    pin: "V2",
    name: "Sensor Battery",
    type: "Integer",
    min: 0,
    max: 100,
    unit: "%",
  },
];
const locations = [
  [
    "Main Street Campus",
    "14.5995° N, 120.9842° E",
    "3 sensors",
    "Online",
    14.5995,
    120.9842,
  ],
  [
    "Riverside Workshop",
    "14.6091° N, 121.0223° E",
    "2 sensors",
    "Online",
    14.6091,
    121.0223,
  ],
  [
    "East Residential Block",
    "14.6210° N, 121.0450° E",
    "1 sensor",
    "Offline",
    14.621,
    121.045,
  ],
];

function Badge({ children, tone = "blue" }) {
  return (
    <span className={`badge ${tone}`}>
      <i />
      {children}
    </span>
  );
}
function Button({
  children,
  className = "",
  onClick,
  kind = "secondary",
  ...props
}) {
  return (
    <button
      className={`button ${kind} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
function PageTitle({ eyebrow, title, description, action }) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow blue">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function Card({ children, className = "" }) {
  return <section className={`card ${className}`}>{children}</section>;
}
function SectionHead({ label, title, action }) {
  return (
    <div className="section-head">
      <div>
        <span className="eyebrow">{label}</span>
        <h3>{title}</h3>
      </div>
      {action}
    </div>
  );
}
function Metric({ label, value, trend, icon: Icon }) {
  return (
    <Card className="metric">
      <div className="metric-icon">
        <Icon size={18} />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small className="trend">{trend}</small>
      </div>
    </Card>
  );
}

function Chart({ points = [], series = [], compact = false, displayLabel = "Level" }) {
  const safeSeries = Array.isArray(series)
    ? series.map((item = {}, index) => ({
      ...item,
      points: Array.isArray(item.points) ? item.points.filter((value) => Number.isFinite(Number(value))) : [],
      color: item.color || ["#2563eb", "#0f766e", "#d97706", "#db2777", "#7c3aed"][index % 5],
    })).filter((item) => item.points.length > 0)
    : [];
  const values = Array.isArray(points) ? points.filter((value) => Number.isFinite(Number(value))) : [];
  const w = 700;
  const h = compact ? 130 : 220;
  const buildPath = (lineValues) => lineValues
    .map((value, index) => `${index ? "L" : "M"} ${((index / Math.max(lineValues.length - 1, 1)) * w).toFixed(1)} ${(h - (value / 120) * h).toFixed(1)}`)
    .join(" ");
  const paths = safeSeries.length ? safeSeries.map((item) => ({ ...item, path: buildPath(item.points) })) : [{ points: values, path: buildPath(values), color: "#2563eb" }];
  return (
    <div className={`chart-box ${compact ? "compact" : ""}`}>
      <div className="axis-y">
        <span>120 {displayLabel}</span>
        <span>90</span>
        <span>60</span>
        <span>30</span>
        <span>0</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {[0, 30, 60, 90, 120].map((v) => (
          <line
            key={v}
            x1="0"
            x2={w}
            y1={h - (v / 120) * h}
            y2={h - (v / 120) * h}
          />
        ))}
        {paths.map((item) => (
          <g key={item.id || item.label || item.color}>
            {!safeSeries.length && item.points.length > 0 && <path className="chart-fill" d={`${item.path} L ${w} ${h} L 0 ${h} Z`} style={{ fill: item.color }} />}
            {item.points.length > 0 && <path className="chart-stroke" d={item.path} style={{ stroke: item.color }} />}
          </g>
        ))}
      </svg>
      {!paths.some((item) => item.points.length > 0) && <span className="chart-empty">Waiting for V0 telemetry</span>}
      {safeSeries.length > 0 && <div className="chart-legend">{safeSeries.map((item) => <span key={item.id || item.label}><i style={{ background: item.color }} />{item.label}</span>)}</div>}
      <div className="axis-x">
        <span>Now</span>
        <span>15m</span>
        <span>30m</span>
        <span>45m</span>
        <span>Today</span>
      </div>
    </div>
  );
}
function GaugeWidget({ value = 0, radial = false, displayLabel = "Level" }) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0;
  return radial ? (
    <div className="radial-wrap">
      <div
        className="radial"
        style={{ "--progress": `${Math.round(safeValue * 3.6)}deg` }}
      >
        <strong>{safeValue}</strong>
        <span>{displayLabel}</span>
      </div>
    </div>
  ) : (
    <div className="gauge-wrap">
      <svg viewBox="0 0 220 125">
        <path className="gauge-bg" d="M24 105 A86 86 0 0 1 196 105" />
        <path
          className="gauge-value"
          d="M24 105 A86 86 0 0 1 196 105"
          strokeDasharray={`${(Math.PI * 86 * safeValue) / 100} ${Math.PI * 86}`}
        />
      </svg>
      <strong>
        {safeValue}
        <small>{displayLabel}</small>
      </strong>
      <div>
        <span>0</span>
        <span>100</span>
      </div>
    </div>
  );
}

function WidgetCard({ widget = {}, value = 0, points = [], displayLabel = "Level", onEdit = () => {}, onDelete = () => {} }) {
  return (
    <Card className="canvas-widget">
      <div className="widget-card-head">
        <div>
          <span className="eyebrow blue">{widget?.pin || "V0"} / LIVE STREAM</span>
          <h3>{widget?.title || "Noise Level"}</h3>
        </div>
        <div className="widget-menu">
          <button title="Edit widget" onClick={() => onEdit(widget)}>
            <Pencil size={15} />
          </button>
          <button title="Delete widget" onClick={() => onDelete(widget.id)}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {widget?.kind === "gauge" && <GaugeWidget value={value} displayLabel={displayLabel} />}
      {widget?.kind === "radial" && <GaugeWidget value={value} displayLabel={displayLabel} radial />}
      {widget?.kind === "chart" && <Chart points={points} displayLabel={displayLabel} compact />}
      {widget?.kind === "value" && (
        <div className="value-widget">
          <strong>{value}</strong>
          <span>{displayLabel}</span>
          <small>Current sensor reading</small>
        </div>
      )}
      <div className="widget-foot">
        <span>
          <i className="live-dot" />
          Live data
        </span>
        <span>
          {widget?.min ?? 0}–{widget?.max ?? 120} {widget?.kind === "value" ? displayLabel : ""}
        </span>
      </div>
    </Card>
  );
}

function HomeView({ value = 0, points = [], displayLabel = "Level", setTab = () => {}, connected = false, metrics = {}, devices = [], telemetryByDevice = {}, onToggleDevice = () => {} }) {
  const safeDevices = Array.isArray(devices) ? devices : [];
  const safeTelemetry = telemetryByDevice && typeof telemetryByDevice === "object" ? telemetryByDevice : {};
  const safeMetrics = metrics ?? {};
  const totalReadings = Number(safeMetrics?.totalReadings) || 0;
  const uptimePercentage = Number(safeMetrics?.uptimePercentage) || 0;
  const onlineDevices = Number(safeMetrics?.onlineDeviceCount) || 0;
  const registeredDevices = Number(safeMetrics?.registeredDeviceCount) || 0;
  const isDeviceOnline = String(safeMetrics?.healthStatus ?? "offline").toLowerCase() === "online";
  const latestReading = Number.isFinite(Number(value)) ? Number(value) : 0;
  const chartPoints = Array.isArray(points) ? points : [];
  const activeDevices = safeDevices.filter((item = {}) => item?.isActive === true);
  const chartSeries = activeDevices.map((item, index) => {
    const key = item?.token || item?.id;
    const telemetry = safeTelemetry?.[key] || safeTelemetry?.[item?.id] || {};
    return { id: key || item?.name || index, label: item?.name || "Unnamed device", points: telemetry.points, color: ["#2563eb", "#0f766e", "#d97706", "#db2777", "#7c3aed"][index % 5] };
  });
  return (
    <>
      <PageTitle
        eyebrow="CHISMOSA / OVERVIEW"
        title="Noise monitoring at a glance"
        description="A live workspace for every sound sensor in your ChismOSA deployment."
        action={
          <Button kind="primary" onClick={() => setTab("Web Dashboard")}>
            <LayoutDashboard size={15} />
            Open dashboard
          </Button>
        }
      />
      <div className="metrics">
        <Metric
          label="Total readings"
          value={totalReadings.toLocaleString()}
          trend="Recorded by server"
          icon={Database}
        />
        <Metric
          label="Device uptime"
          value={`${uptimePercentage.toFixed(1)}%`}
          trend="Based on hardware socket time"
          icon={Activity}
        />
        <Metric
          label="Active devices"
          value={`${onlineDevices} / ${registeredDevices}`}
          trend={`${Math.max(0, registeredDevices - onlineDevices)} device${registeredDevices - onlineDevices === 1 ? "" : "s"} offline`}
          icon={Radio}
        />
        <Metric
          label="Health status"
          value={isDeviceOnline ? "Healthy" : "Offline"}
          trend={connected ? "Dashboard connected" : "Waiting for dashboard connection"}
          icon={Zap}
        />
      </div>
      <Card className="home-device-overview">
        <SectionHead label="DEVICE OVERVIEW" title="Registered devices" />
        {safeDevices.length ? (
          <div className="home-device-list">
            {safeDevices.map((item = {}) => {
              const telemetry = safeTelemetry?.[item?.id] || {};
                  const enabled = item?.isActive === true;
              const status = enabled && item.status === "online" ? "Online" : enabled ? "Offline" : "Disabled";
              return (
                <div className="home-device-row" key={item.id}>
                  <div className="table-device">
                    <span className="device-symbol"><Radio size={15} /></span>
                    <span><b>{item?.name || "Unnamed device"}</b><small>{item?.model || "ESP8266"} · {item?.pin || "V0"}</small></span>
                  </div>
                  <span className={`device-health ${status.toLowerCase()}`}>{status}</span>
                  <strong>{telemetry.value ?? item.lastReading ?? 0} {displayLabel}</strong>
                  <span className="home-reading-count">{Number(item.totalReadings) || 0} readings</span>
                  <button className={`device-toggle ${enabled ? "on" : ""}`} type="button" role="switch" aria-checked={enabled} aria-label={`${enabled ? "Disable" : "Enable"} ${item?.name || "device"}`} onClick={() => onToggleDevice(item?.id)}><i /></button>
                </div>
              );
            })}
          </div>
        ) : <p className="empty-metadata-state">No registered devices have reported telemetry yet.</p>}
      </Card>
      <div className="two-col">
        <Card>
          <SectionHead
            label="LIVE STREAM"
            title="Noise level activity"
            action={<Badge tone={isDeviceOnline ? "blue" : "gray"}>{isDeviceOnline ? "Online" : "Offline"}</Badge>}
          />
          <div className="home-chart">
            <Chart points={chartPoints} series={chartSeries} displayLabel={displayLabel} />
          </div>
          <div className="home-live-reading">Latest V0 reading <b>{latestReading} {displayLabel}</b></div>
        </Card>
        <Card>
          <SectionHead label="QUICK SHORTCUTS" title="Manage ChismOSA" />
          <div className="shortcuts">
            <button onClick={() => setTab("Datastreams")}>
              <Database />
              <span>
                <b>Configure datastreams</b>
                <small>Manage virtual pins and thresholds</small>
              </span>
            </button>
            <button onClick={() => setTab("Automation Templates")}>
              <Zap />
              <span>
                <b>Create an automation</b>
                <small>Alert when noise reaches a limit</small>
              </span>
            </button>
            <button onClick={() => setTab("Connection Lifecycle")}>
              <Wifi />
              <span>
                <b>Inspect connection health</b>
                <small>Review device heartbeat events</small>
              </span>
            </button>
          </div>
        </Card>
      </div>
    </>
  );
}

function DeveloperView() {
  const [copied, setCopied] = useState(false);
  const code = `#include <WiFi.h>\n#include <HTTPClient.h>\n\n#define CHISMOSA_DEVICE "NOISE-ESP32-001"\n#define CHISMOSA_AUTH_TOKEN "YOUR_AUTH_TOKEN"\n\nconst char* ssid = "YOUR_WIFI_SSID";\nconst char* password = "YOUR_WIFI_PASSWORD";\n\nvoid setup() {\n  Serial.begin(115200);\n  WiFi.begin(ssid, password);\n}\n\nvoid loop() {\n  double noiseDb = analogRead(34) * 100.0 / 4095.0;\n  // POST noiseDb to ChismOSA virtual pin V0\n  delay(1000);\n}`;
  return (
    <>
      <PageTitle
        eyebrow="DEVELOPER ZONE / TEMPLATE"
        title="ChismOSA template configuration"
        description="Configure firmware, hardware, and secure device connectivity."
        action={
          <Button kind="primary">
            <Code2 size={15} />
            Generate firmware
          </Button>
        }
      />
      <div className="two-col developer-grid">
        <Card>
          <SectionHead
            label="TEMPLATE DETAILS"
            title="Noise Pollution Monitoring"
          />
          <div className="form-grid">
            <label>
              Template ID
              <input value="CHISMOSA_NOISE_001" readOnly />
            </label>
            <label>
              Platform
              <select defaultValue="ESP32">
                <option>ESP32</option>
                <option>ESP8266</option>
              </select>
            </label>
            <label>
              Transport
              <select defaultValue="HTTP + WebSocket">
                <option>HTTP + WebSocket</option>
                <option>MQTT</option>
              </select>
            </label>
            <label>
              Firmware version
              <input defaultValue="v1.4.2" />
            </label>
          </div>
          <div className="hardware-box">
            <CpuIcon />
            <div>
              <b>Supported hardware</b>
              <p>ESP32 DevKit V1, ESP8266 NodeMCU, analog sound sensors</p>
            </div>
            <Badge>Ready</Badge>
          </div>
        </Card>
        <Card>
          <SectionHead
            label="FIRMWARE HELPER"
            title="Arduino code generator"
            action={
              <Button
                onClick={() => {
                  navigator.clipboard?.writeText(code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                <Copy size={14} />
                {copied ? "Copied" : "Copy code"}
              </Button>
            }
          />
          <pre className="code-block">
            <code>{code}</code>
          </pre>
        </Card>
      </div>
    </>
  );
}
function CpuIcon() {
  return <span className="cpu-icon">CPU</span>;
}

function makeToken(existingTokens = []) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  do {
    const bytes = window.crypto?.getRandomValues(new Uint8Array(14));
    const random = Array.from(
      bytes || [],
      (byte) => alphabet[byte % alphabet.length],
    ).join("");
    token = `chismosa_live_tok_${random}`;
  } while (existingTokens.includes(token));
  return token;
}

const defaultDevices = [
  {
    id: "primary",
    name: "NoiseMonitor-ESP32-DEV",
    model: "ESP32",
    sensor: "MAX9814",
    location: "Main Street Campus",
    pin: "V0",
    token: "chismosa_live_tok_primary01",
    ip: "192.168.1.42",
    rssi: "-54 dBm",
    firmware: "v1.4.2",
  },
  {
    id: "esp8266",
    name: "NoiseMonitor-ESP8266-02",
    model: "ESP8266",
    sensor: "KY-037",
    location: "Riverside Workshop",
    pin: "V0",
    token: "chismosa_live_tok_esp826601",
    ip: "192.168.1.43",
    rssi: "-67 dBm",
    firmware: "v1.3.8",
  },
  {
    id: "south",
    name: "Campus-South-Node",
    model: "ESP32-S3",
    sensor: "MAX4466",
    location: "East Residential Block",
    pin: "V0",
    token: "chismosa_live_tok_south0001",
    ip: "10.0.0.18",
    rssi: "-81 dBm",
    firmware: "v1.2.4",
  },
];

function setupCode(device) {
  const wifiLibrary =
    device.model === "ESP8266" || device.model === "ESP01"
      ? "#include <ESP8266WiFi.h>"
      : "#include <WiFi.h>";
  return `${wifiLibrary}
#include <HTTPClient.h>

#define CHISMOSA_AUTH_TOKEN "${device.token}"
#define CHISMOSA_VIRTUAL_PIN "${device.pin}"

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* endpoint = "https://YOUR_CHISMOSA_HOST/api/v1/update";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
}

void loop() {
  double noiseDb = analogRead(A0) * 100.0 / 4095.0;
  HTTPClient http;
  http.begin(String(endpoint) + "?token=" + CHISMOSA_AUTH_TOKEN + "&pin=" + CHISMOSA_VIRTUAL_PIN + "&value=" + String(noiseDb, 1));
  http.POST("");
  http.end();
  delay(1000);
}`;
}

function SetupCodeModal({ device, onClose }) {
  const [copied, setCopied] = useState(false);
  const code = setupCode(device);
  return (
    <Modal title={`Setup code · ${device.name}`} onClose={onClose}>
      <div className="setup-meta">
        <Badge>{device.model}</Badge>
        <span>
          {device.sensor} · {device.pin} · {device.location}
        </span>
      </div>
      <pre className="code-block setup-code">
        <code>{code}</code>
      </pre>
      <Button
        kind="primary"
        onClick={() => {
          navigator.clipboard?.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        <Copy size={14} />
        {copied ? "Copied to clipboard" : "Copy Code to Clipboard"}
      </Button>
    </Modal>
  );
}

function AddDeviceModal({ locations, existingTokens, onClose, onAdd }) {
  const [form, setForm] = useState({
    name: "",
    model: "ESP32",
    connection: "Wi-Fi",
    sensor: "Analog Sound Sensor",
    location: locations[0]?.name || "Unassigned",
    pin: "V0 - Noise Level",
  });
  const update = (key, value) => setForm({ ...form, [key]: value });
  const submit = (event) => {
    event.preventDefault();
    if (!form.name) return;
    onAdd({
      ...form,
      pin: form.pin.split(" ")[0],
      token: makeToken(existingTokens),
      id: `device-${Date.now()}`,
      ip: "Not assigned",
      rssi: "Not connected",
      firmware: "v1.0.0",
    });
    onClose();
  };
  return (
    <Modal title="Add Device" onClose={onClose}>
      <form className="device-form" onSubmit={submit}>
        <label>
          Device Name
          <input
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Library Sensor ESP32"
            required
          />
        </label>
        <label>
          Hardware Model
          <select
            value={form.model}
            onChange={(event) => update("model", event.target.value)}
          >
            {["ESP8266", "ESP32", "ESP32-S3", "ESP32-C3", "ESP01"].map(
              (model) => (
                <option key={model}>{model}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Connection Type
          <select
            value={form.connection}
            onChange={(event) => update("connection", event.target.value)}
          >
            <option>Wi-Fi</option>
          </select>
        </label>
        <label>
          Sound Sensor Model
          <select
            value={form.sensor}
            onChange={(event) => update("sensor", event.target.value)}
          >
            {["Analog Sound Sensor", "MAX4466", "KY-037", "MAX9814"].map(
              (sensor) => (
                <option key={sensor}>{sensor}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Assigned Location
          <select
            value={form.location}
            onChange={(event) => update("location", event.target.value)}
          >
            {locations.length ? (
              locations.map((location) => (
                <option key={location.id}>{location.name}</option>
              ))
            ) : (
              <option>Unassigned</option>
            )}
          </select>
        </label>
        <label>
          Virtual Pin Mapping
          <select
            value={form.pin}
            onChange={(event) => update("pin", event.target.value)}
          >
            <option>V0 - Noise Level</option>
            <option>V1 - Peak Noise</option>
            <option>V2 - Sensor Battery</option>
          </select>
        </label>
        <Button kind="primary" type="submit">
          <Plus size={15} />
          Add Device
        </Button>
      </form>
    </Modal>
  );
}

function DevicesView({ devices = [], setDevices = () => {}, value = 0, displayLabel = "Level", locations = [], setEvents = () => {}, onToggleActive = () => {}, onRename = async () => {} }) {
  const safeDevices = Array.isArray(devices) ? devices : [];
  const safeLocations = Array.isArray(locations) ? locations : [];
  const [adding, setAdding] = useState(false);
  const [setup, setSetup] = useState(null);
  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [visibleTokens, setVisibleTokens] = useState(() => new Set());
  const [copiedTokenId, setCopiedTokenId] = useState(null);
  const onlineCount = safeDevices.filter((device = {}) => device?.status === "online").length;
  const reportedSignals = safeDevices
    .map((device = {}) => Number.parseInt(device?.rssi, 10))
    .filter(Number.isFinite);
  const averageRssi = reportedSignals.length
    ? `${Math.round(reportedSignals.reduce((sum, signal) => sum + signal, 0) / reportedSignals.length)} dBm`
    : "--";
  const persist = (next) => setDevices(next);
  const copyToken = async (device) => {
    try {
      const token = device.token || "";
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(token);
      } else {
        const input = document.createElement("textarea");
        input.value = token;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand("copy");
        input.remove();
        if (!copied) throw new Error("Clipboard copy failed");
      }
      setCopiedTokenId(device.id);
      window.setTimeout(() => setCopiedTokenId(null), 1500);
    } catch (_) {
      setCopiedTokenId(null);
    }
  };
  const toggleTokenVisibility = (deviceId) => {
    setVisibleTokens((current) => {
      const next = new Set(current);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return next;
    });
  };
  return (
    <>
      <PageTitle
        eyebrow="DEVICES / REGISTRY"
        title="ChismOSA hardware"
        description="Monitor device connectivity, signal quality, and access credentials."
        action={
          <Button kind="primary" onClick={() => setAdding(true)}>
            <Plus size={15} />
            Add Device
          </Button>
        }
      />
      <div className="device-summary">
        <Card>
          <span>Registered devices</span>
          <strong>{safeDevices.length}</strong>
          <small>
            Across {new Set(safeDevices.map((device = {}) => device?.location)).size}{" "}
            locations
          </small>
        </Card>
        <Card>
          <span>Online now</span>
          <strong className="blue-text">{onlineCount}</strong>
          <small>of {safeDevices.length} registered devices</small>
        </Card>
        <Card>
          <span>Average RSSI</span>
          <strong>{averageRssi}</strong>
          <small>{reportedSignals.length ? "Reported by hardware" : "No signal data reported"}</small>
        </Card>
      </div>
      <Card>
        <div className="table-toolbar">
          <SectionHead label="DEVICE REGISTRY" title="Registered devices" />
          <div className="search">
            <Search size={14} />
            Filter devices
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Device</th>
              <th>IP address</th>
              <th>Wi-Fi RSSI</th>
              <th>Firmware</th>
              <th>Status</th>
              <th>Auth token</th>
              <th>Setup</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {safeDevices.map((device = {}) => (
              <tr key={device.id}>
                <td>
                  <div className="table-device">
                    <span className="device-symbol">
                      <Radio size={15} />
                    </span>
                    <span>
                      {editingDeviceId === device.id ? (
                        <form className="device-name-edit" onSubmit={async (event) => {
                          event.preventDefault();
                          setRenameError("");
                          try {
                            await onRename(device, editingName);
                            setEditingDeviceId(null);
                          } catch (error) {
                            setRenameError(error.message || "Could not rename device.");
                          }
                        }}>
                          <input aria-label="Device name" value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus />
                          <button type="submit" title="Save device name" aria-label="Save device name"><Save size={14} /></button>
                          <button type="button" title="Cancel rename" aria-label="Cancel rename" onClick={() => setEditingDeviceId(null)}><X size={14} /></button>
                        </form>
                      ) : (
                        <span className="device-name-line">
                          <b>{device.name}</b>
                          <button type="button" className="device-rename-button" title={`Rename ${device.name}`} aria-label={`Rename ${device.name}`} onClick={() => {
                            setEditingName(device.name);
                            setEditingDeviceId(device.id);
                            setRenameError("");
                          }}><Pencil size={12} /></button>
                          <button type="button" className={`device-activate-button ${device.isActive ? "active" : ""}`} title={device.isActive ? `Deactivate ${device.name}` : `Activate ${device.name}`} onClick={() => onToggleActive(device.id)}>{device.isActive ? "Deactivate" : "Activate"}</button>
                        </span>
                      )}
                      <small>
                        {device.sensor} / {device.pin} · {device.location}
                      </small>
                    </span>
                  </div>
                </td>
                <td>{device.ip || "Not reported"}</td>
                <td>{device.rssi || "Not reported"}</td>
                <td>{device.firmware || "Not reported"}</td>
                <td>
                  <div className="device-status-badges">
                    <Badge tone={device.status === "online" ? "blue" : "gray"}>
                      {device.status === "online" ? "Online" : "Offline"}
                    </Badge>
                    {device.isActive && <Badge tone="blue">Active</Badge>}
                  </div>
                </td>
                <td>
                  <div className="device-token">
                    <button
                      className="token-copy"
                      type="button"
                      title="Copy auth token"
                      aria-label={`Copy auth token for ${device.name}`}
                      onClick={() => copyToken(device)}
                    >
                      <code>{visibleTokens.has(device.id) ? device.token : `********${(device.token || "").slice(-4)}`}</code>
                      {copiedTokenId === device.id && <span role="status">Copied</span>}
                    </button>
                    <button
                      className="token-visibility"
                      type="button"
                      title={visibleTokens.has(device.id) ? "Hide auth token" : "Show auth token"}
                      aria-label={`${visibleTokens.has(device.id) ? "Hide" : "Show"} auth token for ${device.name}`}
                      aria-pressed={visibleTokens.has(device.id)}
                      onClick={() => toggleTokenVisibility(device.id)}
                    >
                      {visibleTokens.has(device.id) ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </td>
                <td>
                  <Button
                    className="setup-button"
                    onClick={() => setSetup(device)}
                  >
                    <Code2 size={14} />
                    Code / Setup
                  </Button>
                </td>
                <td>
                  <button
                    className="delete-button"
                    title="Delete device"
                    onClick={() => {
                      persist(devices.filter((item) => item.id !== device.id));
                      if (setEvents) {
                        setEvents((current) => current.filter((event) => event.device !== device.name));
                      }
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {renameError && <p className="form-error" role="alert">{renameError}</p>}
      </Card>
      <div className="device-note">
        Current reading from primary device: <b>{value} {displayLabel}</b>. Auth tokens are
        shown partially for security. New devices start offline until they
        connect.
      </div>
      {adding && (
        <AddDeviceModal
          locations={safeLocations}
          existingTokens={safeDevices.map((device = {}) => device?.token)}
          onClose={() => setAdding(false)}
          onAdd={(device) => persist([...devices, device])}
        />
      )}
      {setup && (
        <SetupCodeModal device={setup} onClose={() => setSetup(null)} />
      )}
    </>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head">
          <h3>{title}</h3>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function AuthModal({ onClose, onAuthenticated }) {
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("admin@chismosa.io");
  const [password, setPassword] = useState("password123");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const submit = (event) => {
    event.preventDefault();
    if (!email || !password || (mode === "signup" && !name)) {
      setError("Complete all required fields to continue.");
      return;
    }
    if (
      mode === "signin" &&
      (email !== "admin@chismosa.io" || password !== "password123")
    ) {
      setError("Use admin@chismosa.io and password123 for the demo account.");
      return;
    }
    onAuthenticated({
      name: mode === "signup" ? name : "ChismOSA Admin",
      email,
      remember,
    });
  };
  return (
    <div className="modal-backdrop auth-backdrop">
      <div className="auth-modal">
        <div className="auth-brand">
          <div className="brand-mark">
            <Zap size={18} fill="currentColor" />
          </div>
          <span>ChismOSA</span>
        </div>
        <button className="auth-close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="auth-copy">
          <span className="eyebrow blue">NOISE POLLUTION MONITORING</span>
          <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          <p>
            {mode === "signin"
              ? "Sign in to access your ChismOSA workspace."
              : "Set up access to your ChismOSA monitoring workspace."}
          </p>
        </div>
        <div className="auth-tabs">
          <button
            className={mode === "signin" ? "active" : ""}
            onClick={() => {
              setMode("signin");
              setError("");
            }}
          >
            Sign In
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
          >
            Create Account
          </button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Full Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your full name"
                autoComplete="name"
              />
            </label>
          )}
          <label>
            Email Address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <div className="password-input">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          {error && <div className="auth-error">{error}</div>}
          {mode === "signin" && (
            <div className="auth-options">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                Remember Me
              </label>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setError(
                    "Password reset instructions would be sent to your email.",
                  )
                }
              >
                Forgot Password?
              </button>
            </div>
          )}
          <Button kind="primary" className="auth-submit">
            {mode === "signin" ? "Log In" : "Sign Up"}
          </Button>
        </form>
        <div className="demo-hint">
          Demo access: <b>admin@chismosa.io</b> / <b>password123</b>
        </div>
      </div>
    </div>
  );
}

function FirebaseAuthModal({ onClose, onAuthenticated }) {
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("admin@chismosa.io");
  const [password, setPassword] = useState("password123");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    if (!email || !password || (mode === "signup" && !name)) {
      setError("Complete all required fields to continue.");
      return;
    }
    setBusy(true);
    try {
      const result = await onAuthenticated({ mode, name, email, password, remember });
      if (result?.verificationRequired) setVerificationEmail(result.email || email);
    } catch (authError) {
      setError(authError.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop auth-backdrop">
      <div className="auth-modal">
        <div className="auth-brand">
          <div className="brand-mark">
            <Zap size={18} fill="currentColor" />
          </div>
          <span>ChismOSA</span>
        </div>
        <button className="auth-close" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="auth-copy">
          <span className="eyebrow blue">NOISE POLLUTION MONITORING</span>
          <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          <p>
            {mode === "signin"
              ? "Sign in with Firebase to access your workspace."
              : "Create a Firebase account for your ChismOSA workspace."}
          </p>
        </div>
        {verificationEmail && (
          <div className="verification-notice" role="status">
            <b>Check your Gmail inbox</b>
            <p>We sent a verification link to {verificationEmail}. Verify your email before signing in to ChismOSA.</p>
          </div>
        )}
        <div className="auth-tabs">
          <button
            className={mode === "signin" ? "active" : ""}
            onClick={() => {
              setMode("signin");
              setError("");
            }}
          >
            Sign In
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
          >
            Create Account
          </button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Full Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your full name"
                autoComplete="name"
              />
            </label>
          )}
          <label>
            Email Address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <div className="password-input">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          {error && <div className="auth-error">{error}</div>}
          {mode === "signin" && (
            <div className="auth-options">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                Remember Me
              </label>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setError(
                    "Password reset requires a Firebase password-reset flow to be enabled.",
                  )
                }
              >
                Forgot Password?
              </button>
            </div>
          )}
          <Button kind="primary" className="auth-submit" disabled={busy}>
            {busy ? "Connecting..." : mode === "signin" ? "Log In" : "Sign Up"}
          </Button>
        </form>
        <div className="demo-hint">
          Demo account must be created in Firebase Authentication:{" "}
          <b>admin@chismosa.io</b>
        </div>
      </div>
    </div>
  );
}

function AuthRequired({ onOpen }) {
  return (
    <div className="auth-required">
      <div className="auth-required-icon">
        <User size={22} />
      </div>
      <span className="eyebrow blue">AUTHENTICATION REQUIRED</span>
      <h2>Sign in to open this view</h2>
      <p>
        The Web Dashboard and Devices manager are protected workspace areas.
      </p>
      <Button kind="primary" onClick={onOpen}>
        <User size={15} />
        Sign In to ChismOSA
      </Button>
    </div>
  );
}

function SettingsView({ user, onSave }) {
  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem("chismosa-settings")) || {};
    } catch (_) {
      return {};
    }
  })();
  const [name, setName] = useState(
    saved.name || user?.name || "ChismOSA Admin",
  );
  const [email, setEmail] = useState(saved.email || user?.email || "");
  const [warning, setWarning] = useState(saved.warning || 85);
  const [frequency, setFrequency] = useState(saved.frequency || "1s");
  const [scale, setScale] = useState(saved.scale || "dBA");
  const [displayLabel, setDisplayLabel] = useState(saved.displayLabel || "Level");
  return (
    <>
      <PageTitle
        eyebrow="PLATFORM / SETTINGS"
        title="Workspace settings"
        description="Manage your ChismOSA profile, alert thresholds, and sensor preferences."
        action={
          <Button
            kind="primary"
            onClick={() => onSave({ name, email, warning, frequency, scale, displayLabel })}
          >
            <Save size={15} />
            Save Settings
          </Button>
        }
      />
      <div className="two-col settings-grid">
        <Card>
          <SectionHead label="PROFILE SETTINGS" title="Your account" />
          <div className="settings-form">
            <label>
              User Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Email Address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <Button
              onClick={() =>
                alert(
                  "Password changes are managed by Firebase Authentication.",
                )
              }
            >
              Change Password
            </Button>
          </div>
        </Card>
        <Card>
          <SectionHead label="ALERT THRESHOLDS" title="Noise warnings" />
          <label className="range-setting">
            High Noise Warning <b>{warning} dB</b>
            <input
              type="range"
              min="50"
              max="120"
              value={warning}
              onChange={(event) => setWarning(event.target.value)}
            />
          </label>
          <p className="setting-help">
            Alerts are created when the V0 noise reading exceeds this level.
          </p>
        </Card>
        <Card>
          <SectionHead label="SYSTEM PREFERENCES" title="Sensor display" />
          <div className="settings-form">
            <label>
              Refresh frequency
              <select
                value={frequency}
                onChange={(event) => setFrequency(event.target.value)}
              >
                <option>1s</option>
                <option>2s</option>
                <option>5s</option>
              </select>
            </label>
            <label>
              Decibel scale
              <select
                value={scale}
                onChange={(event) => setScale(event.target.value)}
              >
                <option>dBA</option>
                <option>dBC</option>
                <option>raw dB</option>
              </select>
            </label>
            <label>
              Display Label / Unit Alias
              <input
                value={displayLabel}
                onChange={(event) => setDisplayLabel(event.target.value)}
                placeholder="Level"
                maxLength={24}
              />
              <small className="setting-help">Alternative label shown on gauges and metric cards (e.g., Level, dB, Noise)</small>
            </label>
          </div>
        </Card>
      </div>
    </>
  );
}

function HelpView() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(0);
  const [support, setSupport] = useState(false);
  const topics = [
    [
      "How do I set up an ESP8266 or ESP32?",
      "Install the board package in Arduino IDE, connect the device to Wi-Fi, then use the ChismOSA firmware helper from Developer Zone.",
    ],
    [
      "How do I configure a Virtual Pin?",
      "Open Datastreams, choose Add datastream, assign V0, set the data type and range, then map the pin to a dashboard widget.",
    ],
    [
      "How do I troubleshoot Wi-Fi?",
      "Check the SSID and password, confirm 2.4 GHz access, inspect RSSI in Devices, and verify that the device can reach the ChismOSA API.",
    ],
  ];
  const code =
    'HTTPClient http;\nhttp.begin("https://your-chismosa-host/api/v1/update");\nhttp.addHeader("Content-Type", "application/json");\nhttp.POST("{\\"pin\\":\\"V0\\",\\"value\\":noiseDb}");';
  const filtered = topics.filter((topic) =>
    topic.join(" ").toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="SUPPORT / KNOWLEDGE BASE"
        title="Help Center"
        description="Find practical answers for deploying your ChismOSA noise sensors."
        action={
          <Button kind="primary" onClick={() => setSupport(true)}>
            <Plus size={15} />
            Contact support
          </Button>
        }
      />
      <div className="help-search">
        <Search size={17} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search help topics, setup guides, and troubleshooting..."
        />
      </div>
      <div className="help-grid">
        <Card>
          <SectionHead label="FAQ" title="Popular questions" />
          {filtered.map((topic, index) => (
            <div className="faq" key={topic[0]}>
              <button onClick={() => setOpen(open === index ? -1 : index)}>
                <b>{topic[0]}</b>
                <ChevronDown
                  size={16}
                  className={open === index ? "rotate" : ""}
                />
              </button>
              {open === index && <p>{topic[1]}</p>}
            </div>
          ))}
          {!filtered.length && (
            <p className="setting-help">No matching help topics found.</p>
          )}
        </Card>
        <Card>
          <SectionHead
            label="QUICK START"
            title="Post a noise reading"
            action={
              <Button onClick={() => navigator.clipboard?.writeText(code)}>
                <Copy size={14} />
                Copy
              </Button>
            }
          />
          <pre className="code-block quick-code">
            <code>{code}</code>
          </pre>
          <p className="setting-help">
            Replace the host and send your V0 reading once every configured
            refresh interval.
          </p>
        </Card>
      </div>
      {support && (
        <Modal
          title="Contact ChismOSA support"
          onClose={() => setSupport(false)}
        >
          <label>
            Subject
            <input placeholder="What do you need help with?" />
          </label>
          <label>
            Describe the issue
            <textarea placeholder="Include device ID, location, and recent readings." />
          </label>
          <Button kind="primary" onClick={() => setSupport(false)}>
            Submit request
          </Button>
        </Modal>
      )}
    </>
  );
}

function AuthLanding({ login, signup }) {
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("admin@chismosa.io");
  const [password, setPassword] = useState("password123");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    if (!email || !password || (mode === "signup" && !name)) {
      setError("Complete all required fields to continue.");
      return;
    }
    setBusy(true);
    try {
      const result = mode === "signup"
        ? await signup({ name, email, password, remember })
        : await login({ email, password, remember });
      if (result?.verificationRequired) setVerificationEmail(result.email || email);
    } catch (authError) {
      setError(authError.message || "Unable to authenticate with Firebase.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-landing">
      <div className="landing-brand">
        <div className="landing-mark">
          <Zap size={25} fill="currentColor" />
        </div>
        <div>
          <strong>ChismOSA</strong>
          <span>Noise Pollution Monitoring Platform</span>
        </div>
      </div>
      <div className="landing-card">
        <div className="landing-copy">
          <span className="eyebrow blue">WELCOME TO CHISMOSA</span>
          <h1>Listen to your environment.</h1>
          <p>
            Securely access your sensor network, live dashboards, and noise
            intelligence workspace.
          </p>
        </div>
        <div className="auth-tabs">
          <button
            className={mode === "signin" ? "active" : ""}
            onClick={() => {
              setMode("signin");
              setError("");
            }}
          >
            Sign In
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setError("");
            }}
          >
            Create Account
          </button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Full Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your full name"
                autoComplete="name"
              />
            </label>
          )}
          <label>
            Email Address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <div className="password-input">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          {error && <div className="auth-error">{error}</div>}
          {mode === "signin" && (
            <div className="auth-options">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                Remember Me
              </label>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setError(
                    "Use Firebase Console password reset or add a reset-email flow.",
                  )
                }
              >
                Forgot Password?
              </button>
            </div>
          )}
          <Button kind="primary" className="auth-submit" disabled={busy}>
            {busy
              ? "Authenticating..."
              : mode === "signin"
                ? "Log In"
                : "Sign Up"}
          </Button>
        </form>
        <div className="landing-demo">
          Firebase Authentication is enabled for this ChismOSA workspace.
        </div>
      </div>
      {verificationEmail && (
        <div className="verification-backdrop" role="presentation">
          <section className="verification-dialog" role="dialog" aria-modal="true" aria-labelledby="verification-title">
            <div className="verification-icon"><Mail size={22} /></div>
            <h2 id="verification-title">Verify your email</h2>
            <p>We sent a verification link to <b>{verificationEmail}</b>. Open your Gmail inbox and verify your account before signing in.</p>
            <Button kind="primary" onClick={() => {
              setVerificationEmail("");
              setMode("signin");
              setError("");
            }}>Continue to sign in</Button>
          </section>
        </div>
      )}
      <small className="landing-footer">
        CHISMOSA IOT · SECURE WORKSPACE ACCESS
      </small>
    </main>
  );
}


const sensorIcon = L.divIcon({
  className: "sensor-marker",
  html: "<span></span>",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function LocationClickCapture({ onPick }) {
  useMapEvents({
    click: (event) => onPick(event.latlng.lat, event.latlng.lng),
  });
  return null;
}

function InvalidateMapSize() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function FlyToLocation({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location)
      map.flyTo([location.lat, location.lng], 17, { duration: 1.2 });
  }, [location, map]);
  return null;
}

function locationRecord(loc, index) {
  return {
    id: index + 1,
    name: loc[0],
    address: loc[1],
    devices: loc[2],
    status: loc[3],
    limit: 85,
    lat: loc[4],
    lng: loc[5],
  };
}

function LegacyLocationsView() {
  const [items, setItems] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem("chismosa-locations")) ||
        locations.map((loc, index) => ({
          id: index + 1,
          name: loc[0],
          address: loc[1],
          devices: loc[2],
          status: loc[3],
          limit: 85,
        }))
      );
    } catch (_) {
      return locations.map((loc, index) => ({
        id: index + 1,
        name: loc[0],
        address: loc[1],
        devices: loc[2],
        status: loc[3],
        limit: 85,
      }));
    }
  });
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    device: "NoiseMonitor-ESP32-DEV",
    limit: 85,
  });
  const persist = (next) => {
    setItems(next);
    localStorage.setItem("chismosa-locations", JSON.stringify(next));
  };
  useEffect(() => {
    if (!devices.length) return;
    setItems((current) => {
      let changed = false;
      const next = [...current];
      devices.forEach((device) => {
        if (!device.location) return;
        const locationIndex = next.findIndex((item) => item.name === device.location);
        const syncedLocation = locationIndex >= 0
          ? {
              ...next[locationIndex],
              device: device.name,
              status: device.status === "online" ? "Online" : "Offline",
              devices: "1 sensor",
            }
          : {
              id: `device-location-${device.id}`,
              name: device.location,
              address: "Coordinates not configured",
              lat: Number(device.lat) || fallback[0].lat,
              lng: Number(device.lng) || fallback[0].lng,
              device: device.name,
              devices: "1 sensor",
              status: device.status === "online" ? "Online" : "Offline",
              limit: 85,
            };
        if (locationIndex < 0) {
          next.push(syncedLocation);
          changed = true;
        } else if (next[locationIndex].device !== syncedLocation.device || next[locationIndex].status !== syncedLocation.status) {
          next[locationIndex] = syncedLocation;
          changed = true;
        }
      });
      if (changed) localStorage.setItem("chismosa-locations", JSON.stringify(next));
      return changed ? next : current;
    });
  }, [devices, fallback]);
  const openForm = (item) => {
    setEditing(item || { id: null });
    setForm(
      item
        ? {
            name: item.name,
            address: item.address,
            device: item.device || "NoiseMonitor-ESP32-DEV",
            limit: item.limit || 85,
          }
        : {
            name: "",
            address: "",
            device: "NoiseMonitor-ESP32-DEV",
            limit: 85,
          },
    );
  };
  const submit = (event) => {
    event.preventDefault();
    if (!form.name || !form.address) return;
    const nextItem = {
      id: editing.id || Date.now(),
      name: form.name,
      address: form.address,
      devices: "1 sensor",
      device: form.device,
      status: "Online",
      limit: Number(form.limit),
    };
    persist(
      editing.id
        ? items.map((item) => (item.id === editing.id ? nextItem : item))
        : [...items, nextItem],
    );
    setEditing(null);
  };
  useEffect(() => {
    const query = form.address.trim();
    if (query.length < 3) { setSearchResults([]); return undefined; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=ph&q=${encodeURIComponent(query)}`, { headers: { "Accept-Language": "en" } });
        setSearchResults(await response.json());
      } catch (_) { setSearchResults([]); } finally { setSearching(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [form.address]);
  const selectSearchResult = (result) => {
    const lat = Number(result.lat); const lng = Number(result.lon);
    setForm((current) => ({ ...current, address: result.display_name, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
    setMapFocus({ lat, lng }); setSearchResults([]);
  };
  return (
    <>
      <PageTitle
        eyebrow="LOCATIONS / FIELD MAP"
        title="Monitoring locations"
        description="Physical installation sites for ChismOSA sound sensors."
        action={
          <Button kind="primary" onClick={() => openForm()}>
            <Plus size={15} />
            Add New Location
          </Button>
        }
      />
      <div className="location-layout">
        <Card className="map-card">
          <div className="map-surface">
            <div className="map-grid" />
            {items.map((loc, index) => (
              <button className={`map-pin pin-${index % 3}`} key={loc.id}>
                <MapPin size={26} fill="currentColor" />
                <span>{index + 1}</span>
              </button>
            ))}
            <div className="map-label">
              <b>Metro Manila monitoring network</b>
              <small>{items.length} active installation sites</small>
            </div>
          </div>
        </Card>
        <div className="location-list">
          {items.map((loc, index) => (
            <Card key={loc.id} className="location-item">
              <div className={`location-number n-${index % 3}`}>
                {index + 1}
              </div>
              <div>
                <b>{loc.name}</b>
                <span>{loc.address}</span>
                <small>
                  {loc.devices} ·{" "}
                  <strong
                    className={loc.status === "Online" ? "blue-text" : ""}
                  >
                    {loc.status}
                  </strong>{" "}
                  · alert at {loc.limit} dB
                </small>
              </div>
              <button
                className="table-more"
                title="Edit location"
                onClick={() => openForm(loc)}
              >
                <Pencil size={15} />
              </button>
              <button
                className="delete-button"
                title="Delete location"
                onClick={() =>
                  persist(items.filter((item) => item.id !== loc.id))
                }
              >
                <Trash2 size={15} />
              </button>
            </Card>
          ))}
        </div>
      </div>
      {editing && (
        <Modal
          title={editing.id ? "Edit Location" : "Add Location"}
          onClose={() => setEditing(null)}
        >
          <form className="location-form" onSubmit={submit}>
            <label>
              Location Name
              <input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="Main Library 2nd Floor"
              />
            </label>
            <label>
              GPS Coordinates / Address
              <input
                value={form.address}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
                placeholder="14.5995° N, 120.9842° E"
              />
            </label>
            <label>
              Assigned Device ID
              <select
                value={form.device}
                onChange={(event) =>
                  setForm({ ...form, device: event.target.value })
                }
              >
                <option>NoiseMonitor-ESP32-DEV</option>
                <option>NoiseMonitor-ESP8266-02</option>
                <option>Campus-South-Node</option>
              </select>
            </label>
            <label>
              Decibel Alert Limit
              <input
                type="number"
                min="0"
                max="140"
                value={form.limit}
                onChange={(event) =>
                  setForm({ ...form, limit: event.target.value })
                }
              />
            </label>
            <Button kind="primary" type="submit">
              {editing.id ? "Save Location" : "Add Location"}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}

function LocationsView({ value = 48, devices, activeDevice }) {
  const fallback = useMemo(() => locations.map(locationRecord), []);
  const [items, setItems] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("chismosa-locations"));
      return (saved || fallback).map((item, index) => ({
        ...item,
        lat: Number.isFinite(Number(item.lat))
          ? Number(item.lat)
          : fallback[index]?.lat || 14.5995,
        lng: Number.isFinite(Number(item.lng))
          ? Number(item.lng)
          : fallback[index]?.lng || 120.9842,
      }));
    } catch (_) {
      return fallback;
    }
  });
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [mapFocus, setMapFocus] = useState(null);
  const [form, setForm] = useState({
    name: "",
    address: "",
    lat: "14.5995",
    lng: "120.9842",
    device: activeDevice?.name || devices[0]?.name || "",
    limit: 85,
  });
  const persist = (next) => {
    setItems(next);
    localStorage.setItem("chismosa-locations", JSON.stringify(next));
  };
  const openForm = (item) => {
    setEditing(item || { id: null });
    setForm(
      item
        ? {
            name: item.name,
            address: item.address,
            lat: String(item.lat),
            lng: String(item.lng),
            device: item.device || activeDevice?.name || devices[0]?.name || "",
            limit: item.limit || 85,
          }
        : {
            name: "",
            address: "",
            lat: "14.5995",
            lng: "120.9842",
            device: activeDevice?.name || devices[0]?.name || "",
            limit: 85,
          },
    );
  };
  const pick = async (lat, lng) => {
    setForm((current) => ({ ...current, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
    setMapFocus({ lat, lng });
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, { headers: { "Accept-Language": "en" } });
      const result = await response.json();
      setForm((current) => ({ ...current, address: result.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}` }));
      setSelected({ lat, lng, name: result.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}` });
    } catch (_) { setForm((current) => ({ ...current, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` })); }
  };
  const selectSearchResult = (result) => {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    setForm((current) => ({
      ...current,
      address: result.display_name,
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
    }));
    setMapFocus({ lat, lng });
    setSearchResults([]);
    setTimeout(() => setSelected({ lat, lng, name: result.display_name }), 300);
  };
  useEffect(() => {
    if (form.device && devices.some((device) => device.name === form.device)) return;
    setForm((current) => ({ ...current, device: devices[0]?.name || "" }));
  }, [devices, form.device]);
  const submit = (event) => {
    event.preventDefault();
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    if (!form.name || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const next = {
      id: editing.id || Date.now(),
      name: form.name,
      address: form.address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      lat,
      lng,
      device: form.device,
      devices: "1 sensor",
      status: "Online",
      limit: Number(form.limit),
    };
    persist(
      editing.id
        ? items.map((item) => (item.id === editing.id ? next : item))
        : [...items, next],
    );
    setEditing(null);
  };
  return (
    <>
      <PageTitle
        eyebrow="LOCATIONS / FIELD MAP"
        title="Monitoring locations"
        description="Pin every ChismOSA sensor to its exact installation coordinates."
        action={
          <Button kind="primary" onClick={() => openForm()}>
            <Plus size={15} />
            Add New Location
          </Button>
        }
      />
      <div className="location-layout">
        <Card className="map-card">
          <div className="leaflet-map">
            <MapContainer
              center={[14.5995, 120.9842]}
              zoom={13}
              maxNativeZoom={18}
              maxZoom={22}
              scrollWheelZoom
              doubleClickZoom
              className="leaflet-container"
            >
              <InvalidateMapSize />
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxNativeZoom={18}
                maxZoom={22}
              />
              <FlyToLocation location={selected} />
              {items.map((item) => (
                <Marker
                  key={item.id}
                  position={[item.lat, item.lng]}
                  icon={sensorIcon}
                >
                  <Tooltip direction="top" offset={[0, -8]}>
                    {item.name} · {value} dB · {item.status}
                  </Tooltip>
                  <Popup>
                    <b>{item.name}</b>
                    <br />
                    Current noise: {value} dB
                    <br />
                    Status: {item.status}
                    <br />
                    {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </Card>
        <div className="location-list">
          {items.map((item, index) => (
            <Card
              key={item.id}
              className="location-item location-clickable"
              onClick={() => setSelected(item)}
            >
              <div className={`location-number n-${index % 3}`}>
                {index + 1}
              </div>
              <div>
                <b>{item.name}</b>
                <span>{item.address}</span>
                <small>
                  {item.devices || "1 sensor"} ·{" "}
                  <strong className="blue-text">{item.status}</strong> ·{" "}
                  {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                </small>
              </div>
              <button
                className="table-more"
                title="Edit location"
                onClick={(event) => {
                  event.stopPropagation();
                  openForm(item);
                }}
              >
                <Pencil size={15} />
              </button>
              <button
                className="delete-button"
                title="Delete location"
                onClick={(event) => {
                  event.stopPropagation();
                  persist(items.filter((entry) => entry.id !== item.id));
                }}
              >
                <Trash2 size={15} />
              </button>
            </Card>
          ))}
        </div>
      </div>
      {editing && (
        <Modal
          title={editing.id ? "Edit Location" : "Add Location"}
          onClose={() => setEditing(null)}
        >
          <form className="location-form" onSubmit={submit}>
            <label>
              Location Name
              <input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="brgy 225"
                required
              />
            </label>
            <label className="address-search-label">
              Address / Location Search
              <div className="address-search">
                <input 
                  value={form.address} 
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm({ ...form, address: value });
                    if (value.length > 2) {
                      setSearching(true);
                      fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(value)}`, { headers: { "Accept-Language": "en" } })
                        .then((res) => res.json())
                        .then((results) => {
                          setSearchResults(results.slice(0, 5));
                          setSearching(false);
                        })
                        .catch(() => setSearching(false));
                    } else {
                      setSearchResults([]);
                    }
                  }} 
                  placeholder="e.g., Barangay 225, Tondo, Manila" 
                  autoComplete="off" 
                  required 
                />
                <Button type="button" onClick={() => { if (searchResults[0]) selectSearchResult(searchResults[0]); }} disabled={searching || !searchResults.length}><Search size={14} />{searching ? "Searching" : "Search"}</Button>
                {searchResults.length > 0 && <div className="address-results">{searchResults.map((result) => <button type="button" key={`${result.place_id}-${result.lat}`} onClick={() => selectSearchResult(result)}><MapPin size={14} /><span>{result.display_name}</span></button>)}</div>}
              </div>
            </label>
            <div className="location-picker">
              <MapContainer
                center={[
                  Number(form.lat) || 14.5995,
                  Number(form.lng) || 120.9842,
                ]}
                zoom={13}
                maxNativeZoom={18}
                maxZoom={22}
                scrollWheelZoom
                doubleClickZoom
                className="picker-map"
              >
                <InvalidateMapSize />
                <FlyToLocation location={mapFocus} />
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maxNativeZoom={18}
                  maxZoom={22}
                />
                <LocationClickCapture onPick={pick} />
                <Marker
                  position={[
                    Number(form.lat) || 14.5995,
                    Number(form.lng) || 120.9842,
                  ]}
                  icon={sensorIcon}
                />
              </MapContainer>
              <span>Search an address or click the map to fine-tune the pin.</span>
            </div>
            <label>
              Assigned Device ID
              <select
                value={form.device}
                onChange={(event) =>
                  setForm({ ...form, device: event.target.value })
                }
              >
                {devices.length ? devices.map((device) => (
                  <option key={device.id} value={device.name}>{device.name}</option>
                )) : <option value="">No registered devices</option>}
              </select>
            </label>
            <label>
              Decibel Alert Limit
              <input
                type="number"
                min="0"
                max="140"
                value={form.limit}
                onChange={(event) =>
                  setForm({ ...form, limit: event.target.value })
                }
              />
            </label>
            <div className="modal-actions">
              <Button type="button" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button kind="primary" type="submit">
                {editing.id ? "Save Location" : "Add Location"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function StreamsView({ streams, setStreams }) {
  const safeStreams = Array.isArray(streams) ? streams : [];
  const addStream = () =>
    setStreams([
      ...safeStreams,
      {
        id: Date.now(),
        pin: `V${safeStreams.length}`,
        name: "New datastream",
        type: "Double",
        min: 0,
        max: 100,
        unit: "",
      },
    ]);
  const update = (id, key, value) =>
    setStreams(
      safeStreams.map((stream = {}) =>
        stream.id === id ? { ...stream, [key]: value } : stream,
      ),
    );
  return (
    <>
      <PageTitle
        eyebrow="DEVELOPER ZONE / DATASTREAMS"
        title="Virtual pin manager"
        description="Define how ChismOSA reads, validates, and displays sensor values."
        action={
          <Button kind="primary" onClick={addStream}>
            <Plus size={15} />
            Add datastream
          </Button>
        }
      />
      <Card>
        <div className="table-toolbar">
          <SectionHead label="VIRTUAL PINS" title="Datastream configuration" />
          <div className="search">
            <Search size={14} />
            Search pins
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Pin</th>
              <th>Datastream name</th>
              <th>Data type</th>
              <th>Minimum</th>
              <th>Maximum</th>
              <th>Unit</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {safeStreams.map((stream = {}) => (
              <tr key={stream.id}>
                <td>
                  <span className="pin-chip">{stream.pin}</span>
                </td>
                <td>
                  <input
                    className="table-input wide"
                    value={stream.name}
                    onChange={(event) =>
                      update(stream.id, "name", event.target.value)
                    }
                  />
                </td>
                <td>
                  <select
                    className="inline-select"
                    value={stream.type}
                    onChange={(event) =>
                      update(stream.id, "type", event.target.value)
                    }
                  >
                    <option>Double</option>
                    <option>Integer</option>
                  </select>
                </td>
                <td>
                  <input
                    className="table-input"
                    type="number"
                    value={stream.min}
                    onChange={(event) =>
                      update(stream.id, "min", event.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    className="table-input"
                    type="number"
                    value={stream.max}
                    onChange={(event) =>
                      update(stream.id, "max", event.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    className="table-input"
                    value={stream.unit}
                    onChange={(event) =>
                      update(stream.id, "unit", event.target.value)
                    }
                    placeholder="dB"
                  />
                </td>
                <td>
                  <button
                    className="delete-button"
                    onClick={() =>
                      setStreams(
                        streams.filter((item) => item.id !== stream.id),
                      )
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="info-banner">
        <Database size={17} />
        <span>
          Changes apply to the dashboard widgets mapped to each virtual pin.
        </span>
      </div>
    </>
  );
}

function RulesView({ rules = [], setRules = () => {}, notificationPermission = "unsupported", requestNotificationPermission = () => {} }) {
  const safeRules = Array.isArray(rules) ? rules : [];
  const [editingRule, setEditingRule] = useState(null);
  const [draft, setDraft] = useState(null);
  const [draftError, setDraftError] = useState("");
  const updateRules = (next) => {
    setRules(next);
    localStorage.setItem("chismosa-rules", JSON.stringify(next));
  };
  const openRuleEditor = (rule = null) => {
    const match = rule?.condition?.match(/^(.*?)(-?\d+(?:\.\d+)?)(\s*dB.*)$/i);
    setEditingRule(rule);
    setDraft(rule ? {
      name: rule.name,
      conditionPrefix: match?.[1] || "Noise Level V0 > ",
      threshold: match?.[2] || "85",
      conditionSuffix: match?.[3] || " dB",
      action: rule.action,
      active: rule.active,
    } : {
      name: "New automation rule",
      conditionPrefix: "Noise Level V0 > ",
      threshold: "85",
      conditionSuffix: " dB",
      action: "Send notification",
      active: true,
    });
    setDraftError("");
  };
  const saveRule = (event) => {
    event.preventDefault();
    const threshold = Number(draft.threshold);
    if (!draft.name.trim() || !Number.isFinite(threshold)) {
      setDraftError("Enter a rule name and a valid numeric threshold.");
      return;
    }
    const rule = {
      id: editingRule?.id || Date.now(),
      name: draft.name.trim(),
      condition: `${draft.conditionPrefix}${threshold}${draft.conditionSuffix}`,
      action: draft.action.trim(),
      active: draft.active,
    };
    updateRules(editingRule
      ? safeRules.map((item = {}) => item?.id === editingRule.id ? rule : item)
      : [...safeRules, rule]);
    setDraft(null);
    setEditingRule(null);
  };
  const toggleRule = (id) => updateRules(safeRules.map((item = {}) =>
    item?.id === id ? { ...item, active: !item.active } : item,
  ));
  const deleteRule = (id) => updateRules(safeRules.filter((item = {}) => item?.id !== id));
  return (
    <>
      <PageTitle
        eyebrow="DEVELOPER ZONE / AUTOMATION"
        title="Automation templates"
        description="Turn sound thresholds into actions for your monitoring team."
        action={
          <div className="rule-header-actions">
            <Button
              onClick={requestNotificationPermission}
              disabled={notificationPermission === "unsupported" || notificationPermission === "granted"}
              title={notificationPermission === "denied" ? "Notifications are blocked in browser settings" : "Allow desktop noise alerts"}
            >
              <Bell size={15} />
              {notificationPermission === "granted" ? "Desktop alerts enabled" : notificationPermission === "denied" ? "Alerts blocked" : notificationPermission === "unsupported" ? "Alerts unavailable" : "Enable desktop alerts"}
            </Button>
            <Button kind="primary" onClick={() => openRuleEditor()}>
              <Plus size={15} />
              Create rule
            </Button>
          </div>
        }
      />
      <div className="rule-list">
        {safeRules.map((rule = {}) => (
          <Card className="rule-card" key={rule.id}>
            <div className="rule-icon">
              <Zap size={19} />
            </div>
            <div className="rule-main">
              <div>
                <h3>{rule.name}</h3>
                <Badge tone={rule.active ? "blue" : "gray"}>
                  {rule.active ? "Active" : "Paused"}
                </Badge>
              </div>
              <div className="rule-flow">
                <span>IF</span>
                <b>{rule.condition}</b>
                <span>THEN</span>
                <b>{rule.action}</b>
              </div>
            </div>
            <button
              className={`switch ${rule.active ? "on" : ""}`}
              type="button"
              title={rule.active ? "Pause rule" : "Activate rule"}
              aria-label={`${rule.active ? "Pause" : "Activate"} ${rule.name}`}
              aria-pressed={rule.active}
              onClick={() => toggleRule(rule.id)}
            >
              <i />
            </button>
            <button className="table-more" title="Edit automation rule" aria-label={`Edit ${rule.name}`} onClick={() => openRuleEditor(rule)}>
              <Pencil size={15} />
            </button>
            <button className="delete-button" title="Delete template" onClick={() => deleteRule(rule.id)}>
              <Trash2 size={15} />
            </button>
          </Card>
        ))}
      </div>
      {draft && (
        <Modal title={editingRule ? "Edit automation rule" : "Create automation rule"} onClose={() => setDraft(null)}>
          <form className="rule-editor" onSubmit={saveRule}>
            <label>
              Rule name
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
            </label>
            <label>
              Condition before threshold
              <input value={draft.conditionPrefix} onChange={(event) => setDraft({ ...draft, conditionPrefix: event.target.value })} required />
            </label>
            <label>
              Threshold
              <input type="number" step="any" value={draft.threshold} onChange={(event) => setDraft({ ...draft, threshold: event.target.value })} required />
            </label>
            <label>
              Condition after threshold
              <input value={draft.conditionSuffix} onChange={(event) => setDraft({ ...draft, conditionSuffix: event.target.value })} />
            </label>
            <label>
              Action
              <input value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value })} required />
            </label>
            <label className="rule-active-field">
              <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
              Active
            </label>
            {draftError && <p className="form-error" role="alert">{draftError}</p>}
            <div className="modal-actions">
              <Button type="button" onClick={() => setDraft(null)}>Cancel</Button>
              <Button type="submit" kind="primary">{editingRule ? "Save changes" : "Create rule"}</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
function MetadataView({ devices = [], value = 0, displayLabel = "Level", activeDeviceId = "", onActiveDeviceChange = () => {} }) {
  const safeDevices = Array.isArray(devices) ? devices : [];
  const [selectedDevice, setSelectedDevice] = useState(() => safeDevices.find((device = {}) => String(device?.id) === String(activeDeviceId))?.name || safeDevices[0]?.name || "");
  const [metadata, setMetadata] = useState(() => JSON.parse(localStorage.getItem("chismosa-metadata") || "{}"));
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("chismosa-metadata") || "{}");
    setMetadata(saved);
  }, []);
  useEffect(() => {
    const active = safeDevices.find((device = {}) => String(device?.id) === String(activeDeviceId));
    if (active) setSelectedDevice(active.name);
    else if (safeDevices.length && !safeDevices.some((device = {}) => device?.name === selectedDevice)) setSelectedDevice(safeDevices[0]?.name || "");
  }, [safeDevices, selectedDevice, activeDeviceId]);
  const fields = metadata[selectedDevice] || [];
  const activeDevice = safeDevices.find((device = {}) => device?.name === selectedDevice);
  const updateFields = (next) => {
    const updated = { ...metadata, [selectedDevice]: next };
    setMetadata(updated);
    localStorage.setItem("chismosa-metadata", JSON.stringify(updated));
    return updated;
  };
  return (
    <>
      <PageTitle
        eyebrow="DEVELOPER ZONE / METADATA"
        title="Device metadata"
        description="Keep field context attached to every ChismOSA sensor."
        action={
          <Button kind="primary" disabled={!selectedDevice}>
            <Save size={15} />
            Changes saved automatically
          </Button>
        }
      />
      <Card>
        <SectionHead
          label="DEVICE CONTEXT"
          title={safeDevices.length ? "Device context" : "No hardware telemetry"}
          action={
            <Button disabled={!selectedDevice} onClick={() => updateFields([...fields, ["New field", "Value"]])}>
              <Plus size={14} />
              Add field
            </Button>
          }
        />
        <select value={selectedDevice} onChange={(event) => {
          setSelectedDevice(event.target.value);
          const chosen = safeDevices.find((device = {}) => device?.name === event.target.value);
          if (chosen) onActiveDeviceChange(chosen.id);
        }} disabled={!safeDevices.length}>
          {safeDevices.length ? safeDevices.map((device = {}) => <option key={device?.id} value={device?.name || ""}>{device?.name || "Unnamed device"}</option>) : <option value="">Waiting for device telemetry</option>}
        </select>
        {!safeDevices.length && <p className="empty-metadata-state">Device metadata will appear after hardware telemetry is received.</p>}
        {activeDevice && (
          <div className="active-device-telemetry" aria-live="polite">
            <SectionHead label="ACTIVE HARDWARE" title={activeDevice.name} action={<Badge tone={activeDevice.status === "online" ? "blue" : "gray"}>{activeDevice.status === "online" ? "Online" : "Offline"}</Badge>} />
            <dl>
              <div><dt>Token</dt><dd><code>{activeDevice.token || "Unavailable"}</code></dd></div>
              <div><dt>Firmware</dt><dd>{activeDevice.firmware || "v1.0.0"}</dd></div>
              <div><dt>Pin V0 status</dt><dd>{activeDevice.status === "online" ? "Online" : "Offline"}</dd></div>
              <div><dt>Latest V0 reading</dt><dd>{value} {displayLabel}</dd></div>
              <div><dt>Location</dt><dd>{activeDevice.location || "jiro"}</dd></div>
              <div><dt>Last seen</dt><dd>{activeDevice.lastSeen ? new Date(activeDevice.lastSeen).toLocaleString() : "Awaiting telemetry"}</dd></div>
            </dl>
          </div>
        )}
        <div className="metadata-list">
          {fields.map((item, index) => (
            <div className="metadata-row" key={`${item[0]}-${index}`}>
              <input
                value={item[0]}
                onChange={(event) =>
                  updateFields(
                    fields.map((row, i) =>
                      i === index ? [event.target.value, row[1]] : row,
                    ),
                  )
                }
              />
              <input
                value={item[1]}
                onChange={(event) =>
                  updateFields(
                    fields.map((row, i) =>
                      i === index ? [row[0], event.target.value] : row,
                    ),
                  )
                }
              />
              <button
                className="delete-button"
                onClick={() =>
                  updateFields(fields.filter((_, i) => i !== index))
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
function LogsView({ events = [], kind = "Events & Notifications", devices = [] }) {
  const safeEvents = Array.isArray(events) ? events : [];
  const safeDevices = Array.isArray(devices) ? devices : [];
  const [filter, setFilter] = useState("All");
  const filteredByKind = safeEvents.filter((event = {}) => {
    if (kind === "Connection Lifecycle") {
      return ["info", "connected", "disconnected", "heartbeat"].includes(event.kind) && !event.message.includes("Decibel Warning");
    } else {
      return !["connected", "heartbeat"].includes(event.kind) || event.kind === "warning";
    }
  });
  const visibleEvents = filteredByKind.filter((event) =>
    filter === "All" || event.kind.toLowerCase() === filter.toLowerCase(),
  );
  return (
    <>
      <PageTitle
        eyebrow={`DEVELOPER ZONE / ${kind.toUpperCase()}`}
        title={
          kind === "Connection Lifecycle"
            ? "Connection lifecycle"
            : "Events & notifications"
        }
        description={
          kind === "Connection Lifecycle"
            ? "A live diagnostic record of device connectivity and network health."
            : "Review threshold warnings, sound alarms, and system activity."
        }
        action={<select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option>All</option><option>Info</option><option>Warning</option><option>Critical</option>
        </select>}
      />
      <Card>
        <div className="log-toolbar">
          <div className="log-status">
            <span className="pulse-ring" />
            Live event stream
          </div>
          <span>Last 24 hours</span>
        </div>
        <div className="log-list">
          {visibleEvents.slice(0, 12).map((event, index) => (
            <div className="log-row" key={`${event.time}-${index}`}>
              <span className={`log-icon ${event.kind}`}>
                <Activity size={14} />
              </span>
              <div>
                <b>{event.message}</b>
                <small>{event?.time || "Now"} · {event?.device || safeDevices[0]?.name || "System"}</small>
              </div>
              <span className="log-kind">{event.kind}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function DashboardView({
  widgets = [],
  setWidgets = () => {},
  value = 0,
  points = [],
  displayLabel = "Level",
  liveReadings = {},
  telemetryByDevice = {},
  range,
  setRange,
  device,
  devices = [],
  activeDeviceId = "",
  onActiveDeviceChange = () => {},
}) {
  const safeWidgets = Array.isArray(widgets) ? widgets : [];
  const safeDevices = Array.isArray(devices) ? devices : [];
  const safeLiveReadings = liveReadings && typeof liveReadings === "object" ? liveReadings : {};
  const safeTelemetry = telemetryByDevice && typeof telemetryByDevice === "object" ? telemetryByDevice : {};
  const activeDevices = safeDevices.filter((item = {}) => item?.isActive === true);
  const [editing, setEditing] = useState(null);
  const add = (kind) =>
    setWidgets([
      ...safeWidgets,
      {
        id: `${kind}-${Date.now()}`,
        kind,
        title: kind === "chart" ? "Noise History" : "Noise Level",
        pin: "V0",
        min: 0,
        max: 120,
      },
    ]);
  const update = (key, val) => setEditing({ ...editing, [key]: val });
  const apply = () => {
    setWidgets(
      safeWidgets.map((widget = {}) => (widget?.id === editing?.id ? editing : widget)),
    );
    setEditing(null);
  };
  return (
    <>
      <PageTitle
        eyebrow="DEVELOPER ZONE / WEB DASHBOARD"
        title="Live dashboard canvas"
        description="Click a widget to add it, then map it to a ChismOSA virtual pin."
        action={
          <Button kind="primary">
            <Play size={15} />
            Preview dashboard
          </Button>
        }
      />
      <div className="builder">
        <aside className="widget-box">
          <SectionHead label="WIDGET LIBRARY" title="Widget Box" />
          <div className="widget-search">
            <Search size={14} />
            Search widgets
          </div>
          {widgetTypes.map(([kind, title, detail, Icon]) => (
            <button
              className="library-item"
              key={kind}
              onClick={() => add(kind)}
            >
              <span>
                <Icon size={18} />
              </span>
              <div>
                <b>{title}</b>
                <small>{detail}</small>
              </div>
              <Plus size={15} />
            </button>
          ))}
          <div className="library-tip">
            <Sparkles size={15} />
            Click any widget to add it to the canvas.
          </div>
        </aside>
        <div className="canvas">
          <div className="canvas-device-selector">
            <label htmlFor="active-canvas-device">Active device</label>
            <select id="active-canvas-device" value={activeDeviceId || ""} onChange={(event) => onActiveDeviceChange(event.target.value)} disabled={!safeDevices.length}>
              {!safeDevices.length && <option value="">No registered devices</option>}
              {safeDevices.map((item = {}) => <option key={item?.id} value={item?.id || ""}>{item?.name || "Unnamed device"}</option>)}
            </select>
          </div>
          <div className="canvas-bar">
            <div>
              <span className="eyebrow blue">DASHBOARD CANVAS</span>
              <b>Noise Pollution Monitoring / Production</b>
            </div>
            <span className="canvas-size">{safeWidgets.length} widgets</span>
          </div>
          <Card className="device-card">
            <div className="table-device">
              <span className="device-symbol large">
                <Radio size={17} />
              </span>
              <span>
                <b>{device?.name || device?.deviceName || "Waiting for device"}</b>
                <small>
                  {device?.model || "ESP8266"} - {device?.sensor || "Primary sound sensor"}
                </small>
              </span>
            </div>
            <Badge tone={device?.status === "online" ? "blue" : "gray"}>
              {device?.status === "online" ? "Online" : "Offline"}
            </Badge>
          </Card>
          <div className="dashboard-live-devices">
            {activeDevices.map((item = {}) => {
              const key = item?.token || item?.id;
              const telemetry = safeTelemetry?.[key] || safeTelemetry?.[item?.id] || {};
              const reading = Number.isFinite(Number(safeLiveReadings?.[key]))
                ? Number(safeLiveReadings[key])
                : Number(telemetry.value) || 0;
              return (
                <Card className="dashboard-live-device" key={key || item?.id}>
                  <div className="widget-card-head">
                    <div>
                      <span className="eyebrow blue">LIVE DEVICE</span>
                      <h3>{item?.name || "Unnamed device"}</h3>
                    </div>
                    <Badge tone={item?.status === "online" ? "blue" : "gray"}>
                      {item?.status === "online" ? "Online" : "Offline"}
                    </Badge>
                  </div>
                  <GaugeWidget value={reading} displayLabel={displayLabel} />
                  <div className="widget-foot"><span>{item?.token || item?.id || "Unknown device"}</span><strong>{reading} {displayLabel}</strong></div>
                </Card>
              );
            })}
            {!activeDevices.length && <p className="empty-canvas">Activate a device to view its live gauge.</p>}
          </div>
          <div className="canvas-grid">
            {safeWidgets.map((widget = {}) => (
              <WidgetCard
                key={widget.id}
                widget={widget}
                value={value}
                points={points}
                displayLabel={displayLabel}
                onEdit={setEditing}
                onDelete={(id) =>
                  setWidgets(safeWidgets.filter((item = {}) => item?.id !== id))
                }
              />
            ))}
            {!safeWidgets.length && (
              <div className="empty-canvas">
                <Plus size={18} />
                <b>Add your first widget</b>
                <span>Choose a widget from the library to begin.</span>
              </div>
            )}
          </div>
          <div className="time-controls">
            <span>Chart timeframe</span>
            {["1h", "6h", "1d", "1w", "1mo"].map((item) => (
              <button
                className={range === item ? "active" : ""}
                key={item}
                onClick={() => setRange(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
      {editing && (
        <Modal title="Configure widget" onClose={() => setEditing(null)}>
          <label>
            Widget title
            <input
              value={editing.title}
              onChange={(event) => update("title", event.target.value)}
            />
          </label>
          <label>
            Virtual pin
            <select
              value={editing.pin}
              onChange={(event) => update("pin", event.target.value)}
            >
              <option>V0</option>
              <option>V1</option>
              <option>V2</option>
            </select>
          </label>
          <div className="form-grid">
            <label>
              Minimum
              <input
                type="number"
                value={editing.min}
                onChange={(event) => update("min", event.target.value)}
              />
            </label>
            <label>
              Maximum
              <input
                type="number"
                value={editing.max}
                onChange={(event) => update("max", event.target.value)}
              />
            </label>
          </div>
          <Button kind="primary" onClick={apply}>
            <Save size={14} />
            Apply widget settings
          </Button>
        </Modal>
      )}
    </>
  );
}

function AppContent() {
  const [view, setView] = useState("Developer Zone");
  const [tab, setTab] = useState("Web Dashboard");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [range, setRange] = useState("1h");
  const [authOpen, setAuthOpen] = useState(false);
  const [utilityView, setUtilityView] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const {
    user: authUser,
    loading: authLoading,
    login,
    signup,
    logout,
    isAuthenticated,
  } = useAuth();
  const { connected, device: physicalDevice, devices: telemetryDevices, liveReadings, telemetryByDevice, events, setEvents, metrics, renameDevice, rules, setRules, notificationPermission, requestNotificationPermission } = useWebSocket();
  const [displayLabel, setDisplayLabel] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("chismosa-settings"))?.displayLabel || "Level";
    } catch (_) {
      return "Level";
    }
  });
  const isHardwareConnected = Number(metrics?.onlineDeviceCount) > 0;
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => localStorage.getItem("chismosa-active-device") || "");
  const [widgetLayouts, setWidgetLayouts] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("chismosa-widgets"));
      const storedDeviceId = localStorage.getItem("chismosa-active-device") || "unassigned";
      return Array.isArray(saved)
        ? { [storedDeviceId]: saved }
        : saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch (_) {
      return {};
    }
  });
  const widgets = widgetLayouts[selectedDeviceId] || initialWidgets;
  const setWidgets = (next) => {
    setWidgetLayouts((current) => {
      const updated = { ...current, [selectedDeviceId || "default"]: next };
      localStorage.setItem("chismosa-widgets", JSON.stringify(updated));
      return updated;
    });
  };
  const [streams, setStreams] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("chismosa-streams"));
      return Array.isArray(saved) ? saved : defaultStreams;
    } catch (_) {
      return defaultStreams;
    }
  });
  const [devices, setDevices] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("chismosa-devices"));
      return Array.isArray(saved)
        ? saved.map((device) => ({ ...device, isActive: device?.isActive === true }))
        : [];
    } catch (_) {
      return [];
    }
  });
  const deviceLocations = (() => {
    try {
      return (
        JSON.parse(localStorage.getItem("chismosa-locations")) ||
        locations.map((loc, index) => ({ id: index + 1, name: loc[0] }))
      );
    } catch (_) {
      return locations.map((loc, index) => ({ id: index + 1, name: loc[0] }));
    }
  })();
  const selectedTelemetryDevice = devices.find((item) => String(item?.id) === String(selectedDeviceId)) || physicalDevice || devices[0];
  const selectedTelemetryKey = selectedTelemetryDevice?.token || selectedTelemetryDevice?.id;
  const selectedTelemetry = (selectedTelemetryKey && telemetryByDevice?.[selectedTelemetryKey]) || {};
  const currentValue = Number.isFinite(Number(selectedTelemetry.value)) ? Number(selectedTelemetry.value) : 0;
  const currentPoints = Array.isArray(selectedTelemetry.points) ? selectedTelemetry.points : [];
  useFirestoreSettings(authUser, streams, setStreams, widgets, setWidgets);
  useEffect(() => {
    localStorage.setItem("chismosa-streams", JSON.stringify(streams));
  }, [streams]);
  useEffect(() => {
    localStorage.setItem("chismosa-widgets", JSON.stringify(widgetLayouts));
  }, [widgetLayouts]);
  useEffect(() => {
    setStreams((current) => {
      const updated = current.map((stream) =>
        String(stream.pin).toUpperCase() === "V0" && Number(stream.max) < 120
          ? { ...stream, max: 120 }
          : stream,
      );
      return updated.some((stream, index) => stream !== current[index])
        ? updated
        : current;
    });
    setWidgets((current) => {
      const updated = current.map((widget) =>
        String(widget.pin).toUpperCase() === "V0" && Number(widget.max) < 120
          ? { ...widget, max: 120 }
          : widget,
      );
      return updated.some((widget, index) => widget !== current[index])
        ? updated
        : current;
    });
  }, [streams, widgets]);
  useEffect(() => {
    localStorage.setItem("chismosa-devices", JSON.stringify(devices));
  }, [devices]);
  useEffect(() => {
    if (!telemetryDevices?.length) return;
    setDevices((current) => {
      const next = [...current];
      telemetryDevices.forEach((incoming) => {
        const index = next.findIndex((item) => item.id === incoming.id || (incoming.token && item.token === incoming.token));
        if (index < 0) next.push({ ...incoming, isActive: incoming.isActive === true });
        else next[index] = { ...next[index], ...incoming, isActive: next[index].isActive === true };
      });
      return next;
    });
  }, [telemetryDevices]);
  useEffect(() => {
    if (devices.length === 0) {
      if (selectedDeviceId) setSelectedDeviceId("");
      localStorage.removeItem("chismosa-active-device");
      return;
    }
    if (!devices.some((item) => String(item.id) === String(selectedDeviceId))) {
      const nextId = physicalDevice && devices.some((item) => item.id === physicalDevice.id)
        ? String(physicalDevice.id)
        : String(devices[0].id);
      setSelectedDeviceId(nextId);
      localStorage.setItem("chismosa-active-device", nextId);
    }
  }, [devices, selectedDeviceId, physicalDevice]);
  useEffect(() => {
    if (!physicalDevice) return;
    setDevices((current) => {
      const matchIndex = current.findIndex((item) =>
        item.id === physicalDevice.id ||
        (physicalDevice.token && item.token === physicalDevice.token) ||
        item.name === physicalDevice.name,
      );
      if (matchIndex < 0) return [...current, { ...physicalDevice, isActive: false }];
      const existing = current[matchIndex];
      const merged = { ...existing, ...physicalDevice };
      const unchanged = Object.keys(merged).every((key) => JSON.stringify(existing[key]) === JSON.stringify(merged[key]));
      if (unchanged) return current;
      return current.map((item, index) => index === matchIndex ? merged : item);
    });
  }, [physicalDevice]);
  const selectDevice = (deviceId) => {
    const normalizedId = String(deviceId);
    setSelectedDeviceId(normalizedId);
    localStorage.setItem("chismosa-active-device", normalizedId);
  };
  const toggleDeviceActive = (deviceId) => {
    setDevices((current) => current.map((item) => item.id === deviceId ? { ...item, isActive: item.isActive !== true } : item));
  };
  const activeDevice = devices.find((item) => String(item.id) === String(selectedDeviceId)) || physicalDevice || devices[0];
  const handleRenameDevice = async (device, requestedName) => {
    const name = requestedName.trim();
    if (!name) throw new Error("Device name cannot be empty.");
    const isPhysical = physicalDevice && (
      physicalDevice.id === device.id ||
      (physicalDevice.token && physicalDevice.token === device.token)
    );
    if (isPhysical) await renameDevice(physicalDevice.id, name);
    if (device.name !== name) {
      try {
        const metadata = JSON.parse(localStorage.getItem("chismosa-metadata") || "{}");
        if (metadata[device.name] && !metadata[name]) metadata[name] = metadata[device.name];
        delete metadata[device.name];
        localStorage.setItem("chismosa-metadata", JSON.stringify(metadata));
        const storedLocations = JSON.parse(localStorage.getItem("chismosa-locations") || "[]");
        localStorage.setItem("chismosa-locations", JSON.stringify(storedLocations.map((item) => item.device === device.name ? { ...item, device: name } : item)));
      } catch (_) {}
    }
    setDevices((current) => current.map((item) => item.id === device.id || (device.token && item.token === device.token)
      ? { ...item, name, ...(isPhysical ? { deviceName: name } : {}) }
      : item));
  };
  useEffect(() => {
    if (tab === "Events & Notifications") {
      setUnreadNotifications(0);
    }
  }, [tab]);
  useEffect(() => {
    if (tab !== "Events & Notifications") {
      const warningCount = events.filter((e) => e.kind === "warning" || e.kind === "critical").length;
      setUnreadNotifications(warningCount);
    }
  }, [events, tab]);
  const authenticate = async ({ mode, name, email, password, remember }) => {
    const result = mode === "signup"
      ? await signup({ name, email, password, remember })
      : await login({ email, password, remember });
    if (!result?.verificationRequired) setAuthOpen(false);
    return result;
  };
  const protectedView = (nextView, nextTab = tab) => {
    if (
      !isAuthenticated &&
      (nextView === "Devices" || nextTab === "Web Dashboard")
    ) {
      setAuthOpen(true);
      return;
    }
    setView(nextView);
    if (nextView === "Developer Zone") setTab(nextTab);
  };
  const showTab = (next) => {
    setView("Developer Zone");
    setTab(next);
  };
  if (authLoading)
    return (
      <main className="auth-loading">
        <div className="loading-spinner" />
        <span>Verifying your ChismOSA session...</span>
      </main>
    );
  if (!isAuthenticated) return <AuthLanding login={login} signup={signup} />;
  const content =
    utilityView === "Settings" ? (
      <SettingsView
        user={authUser}
        onSave={(settings) => {
          localStorage.setItem("chismosa-settings", JSON.stringify(settings));
          setDisplayLabel(settings.displayLabel || "Level");
        }}
      />
    ) : utilityView === "Help Center" ? (
      <HelpView />
    ) : view === "Devices" && !isAuthenticated ? (
      <AuthRequired onOpen={() => setAuthOpen(true)} />
    ) : view === "Devices" ? (
      <DevicesView
        devices={devices}
        setDevices={setDevices}
        value={currentValue}
        displayLabel={displayLabel}
        locations={deviceLocations}
        setEvents={setEvents}
        onToggleActive={toggleDeviceActive}
        onRename={handleRenameDevice}
      />
    ) : tab === "Home" ? (
      <HomeView value={currentValue} points={currentPoints} displayLabel={displayLabel} setTab={showTab} connected={connected} metrics={metrics} devices={devices} telemetryByDevice={telemetryByDevice} onToggleDevice={toggleDeviceActive} />
    ) : tab === "Datastreams" ? (
      <StreamsView streams={streams} setStreams={setStreams} />
    ) : tab === "Web Dashboard" && !isAuthenticated ? (
      <AuthRequired onOpen={() => setAuthOpen(true)} />
    ) : tab === "Web Dashboard" ? (
      <DashboardView
        widgets={widgets}
        setWidgets={setWidgets}
        value={currentValue}
        points={currentPoints}
        displayLabel={displayLabel}
        liveReadings={liveReadings}
        telemetryByDevice={telemetryByDevice}
        range={range}
        setRange={setRange}
        devices={devices}
        activeDeviceId={selectedDeviceId}
        onActiveDeviceChange={selectDevice}
        device={activeDevice}
      />
    ) : tab === "Automation Templates" ? (
      <RulesView rules={rules} setRules={setRules} notificationPermission={notificationPermission} requestNotificationPermission={requestNotificationPermission} />
    ) : tab === "Metadata" ? (
      <MetadataView devices={devices} value={currentValue} displayLabel={displayLabel} activeDeviceId={selectedDeviceId} onActiveDeviceChange={selectDevice} />
    ) : (
      <LogsView events={events} kind={tab} devices={devices} />
    );
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Zap size={17} fill="currentColor" />
          </div>
          <span>B.U.L.A.B.O.G</span>
        </div>
        <div className="workspace-label">PLATFORM WORKSPACE</div>
        <div
          className="workspace-switch"
          role="button"
          tabIndex={0}
          onClick={() => {
            setWorkspaceOpen(false);
            setUtilityView("");
            setView("Developer Zone");
            setTab("Home");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setWorkspaceOpen(false);
              setUtilityView("");
              setView("Developer Zone");
              setTab("Home");
            }
          }}
        >
          <div className="workspace-avatar">B</div>
          <div>
            <b>B.U.L.A.B.O.G</b>
            <small>Noise Pollution Monitoring</small>
          </div>
          <button
            className="workspace-arrow"
            type="button"
            aria-label="Toggle workspace menu"
            aria-expanded={workspaceOpen}
            onClick={(event) => {
              event.stopPropagation();
              setWorkspaceOpen((current) => !current);
            }}
          >
            <ChevronDown size={15} />
          </button>
          {workspaceOpen && (
            <div className="workspace-menu" onClick={(event) => event.stopPropagation()}>
              <b>B.U.L.A.B.O.G</b>
              <small>Noise Pollution Monitoring</small>
              <Badge tone={isHardwareConnected ? "blue" : "gray"}>
                {isHardwareConnected ? "Online" : "Offline"}
              </Badge>
            </div>
          )}
        </div>
        <nav className="main-nav">
          {nav.map(([label, Icon]) => (
            <button
              className={view === label ? "active" : ""}
              key={label}
              onClick={() => {
                if (label === "Developer Zone") {
                  setView(label);
                  setUtilityView("");
                  setTab(isAuthenticated ? "Web Dashboard" : "Home");
                } else {
                  setUtilityView("");
                  protectedView(label, tab);
                }
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {view === label && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button
            onClick={() => {
              setUtilityView("Settings");
              setView("");
            }}
          >
            <Settings2 size={17} />
            Settings
          </button>
          <button
            onClick={() => {
              setUtilityView("Help Center");
              setView("");
            }}
          >
            <HelpCircle size={17} />
            Help center
          </button>
          <div className="profile">
            <span>
              {authUser
                ? authUser.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                : "GU"}
            </span>
            <div>
              <b>{authUser ? authUser.name : "Guest user"}</b>
              <small>
                {authUser ? "Administrator" : "Sign in to ChismOSA"}
              </small>
            </div>
            {authUser && (
              <button
                className="logout-button"
                title="Log out"
                onClick={logout}
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow blue">
              B.U.L.A.B.O.G / NOISE POLLUTION MONITORING
            </span>
            <h1>{utilityView || (view === "Developer Zone" ? tab : view)}</h1>
          </div>
          <div className="top-actions">
            <span className={`connection ${isHardwareConnected ? "on" : ""}`}>
              <i />
              {isHardwareConnected ? "Online" : "Offline"}
            </span>
            {authUser ? (
              <div className="auth-user">
                <span>
                  {authUser.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <b>{authUser.name}</b>
                <button onClick={logout}>Log Out</button>
              </div>
            ) : (
              <Button onClick={() => setAuthOpen(true)}>
                <User size={15} />
                Log In
              </Button>
            )}
          </div>
        </header>
        {view === "Developer Zone" && (
          <div className="tabs">
            {tabs.map((item) => (
              <button
                className={tab === item ? "active" : ""}
                key={item}
                onClick={() => protectedView("Developer Zone", item)}
              >
                {item}
                {item === "Events & Notifications" && unreadNotifications > 0 && (
                  <span className="notification-badge" title={`${unreadNotifications} unread notifications`}>{unreadNotifications}</span>
                )}
              </button>
            ))}
          </div>
        )}
        <div className="content">{content}</div>
        {authOpen && (
          <FirebaseAuthModal
            onClose={() => setAuthOpen(false)}
            onAuthenticated={authenticate}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <WebSocketProvider>
      <AppContent />
    </WebSocketProvider>
  );
}
