import { createContext, useContext, useEffect, useRef, useState } from 'react'

const WebSocketContext = createContext(null)
const socketUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000'
const browserSocketUrl = `${socketUrl}${socketUrl.includes('?') ? '&' : '?'}clientType=web`
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const emptyMetrics = {
  totalReadings: 0,
  uptimePercentage: 0,
  healthStatus: 'offline',
  onlineDeviceCount: 0,
  registeredDeviceCount: 0,
}

function makeEvent(kind, message, device) {
  return {
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    kind,
    message,
    device,
  }
}

function normalizeDevice(source = {}) {
  const name = source.name || source.deviceName
  if (!name) return null
  return {
    ...source,
    id: source.id || `physical-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    token: source.token || source.authToken || '',
    firmware: source.firmware || '',
    pin: source.pin || '',
    location: source.location || '',
    status: String(source.status || 'offline').toLowerCase(),
    lastSeen: source.lastSeen || null,
  }
}

function loadRules() {
  try {
    const saved = JSON.parse(localStorage.getItem('chismosa-rules'))
    if (Array.isArray(saved)) {
      return saved.map((rule) => ({
        ...rule,
        threshold: Number.isFinite(Number(rule.threshold))
          ? Number(rule.threshold)
          : Number(rule.condition?.match(/>\s*(-?\d+(?:\.\d+)?)/)?.[1] ?? 85),
      }))
    }
  } catch (_) {}
  return [
    { id: 1, name: 'High noise alert', condition: 'Noise Level V0 > 85 dB', threshold: 85, action: 'Send notification', active: true },
    { id: 2, name: 'Quiet hours watch', condition: 'Noise Level V0 > 65 dB after 22:00', threshold: 65, action: 'Create event', active: false },
  ]
}

export function WebSocketProvider({ children }) {
  const [connected, setConnected] = useState(false)
  const [device, setDevice] = useState(null)
  const [devices, setDevices] = useState([])
  const [liveReadings, setLiveReadings] = useState({})
  const [telemetryByDevice, setTelemetryByDevice] = useState({})
  const [events, setEvents] = useState([])
  const [metrics, setMetrics] = useState(emptyMetrics)
  const [rules, setRules] = useState(loadRules)
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  const reconnectRef = useRef(null)
  const deviceRef = useRef(null)
  const rulesRef = useRef(rules)
  const alertAudioRef = useRef(null)

  const mergeDevice = (nextDevice) => {
    if (!nextDevice) return
    setDevices((current) => {
      const index = current.findIndex((item) => item.id === nextDevice.id || (nextDevice.token && item.token === nextDevice.token))
      if (index < 0) return [...current, nextDevice]
      return current.map((item, itemIndex) => itemIndex === index ? { ...item, ...nextDevice } : item)
    })
  }

  useEffect(() => {
    rulesRef.current = rules
    localStorage.setItem('chismosa-rules', JSON.stringify(rules))
  }, [rules])

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported')
      return 'unsupported'
    }
    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    return permission
  }

  const triggerAlert = (title, body, tag) => {
    if (typeof window !== 'undefined') {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext
        if (AudioContext) {
          if (!alertAudioRef.current) alertAudioRef.current = new AudioContext()
          const audioContext = alertAudioRef.current
          const oscillator = audioContext.createOscillator()
          const gain = audioContext.createGain()
          oscillator.frequency.value = 880
          oscillator.type = 'sine'
          gain.gain.setValueAtTime(0.0001, audioContext.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.01)
          gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.2)
          oscillator.connect(gain)
          gain.connect(audioContext.destination)
          oscillator.start()
          oscillator.stop(audioContext.currentTime + 0.2)
        }
      } catch (_) {}
    }
    if (typeof Notification === 'undefined') return
    const showNotification = () => {
      if (Notification.permission === 'granted') new Notification(title, { body, tag })
    }
    if (Notification.permission === 'default') {
      requestNotificationPermission().then(showNotification).catch(() => {})
    } else {
      showNotification()
    }
  }

  const renameDevice = async (deviceId, name) => {
    const cleanName = name.trim()
    if (!cleanName) throw new Error('Device name cannot be empty.')
    const current = deviceRef.current
    if (!current || current.id !== deviceId) throw new Error('The selected device is not connected.')

    const renamed = { ...current, name: cleanName, deviceName: cleanName }
    deviceRef.current = renamed
    setDevice(renamed)
    const response = await fetch(`${apiUrl}/api/device/name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cleanName, token: current.token }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      throw new Error(result.error || 'Could not save the device name to the server.')
    }
    return renamed
  }

  useEffect(() => {
    let socket
    let disposed = false

    const appendEvent = (entry) => setEvents((current) => [entry, ...current].slice(0, 100))
    const refreshMetrics = () => {
      fetch(`${apiUrl}/api/metrics`)
        .then((response) => response.ok ? response.json() : null)
        .then((nextMetrics) => {
          if (nextMetrics && !disposed) setMetrics({ ...emptyMetrics, ...nextMetrics })
        })
        .catch(() => {})
    }
    const connect = () => {
      if (disposed) return
      socket = new WebSocket(browserSocketUrl)
      socket.onopen = () => {
        setConnected(true)
        refreshMetrics()
      }
      socket.onclose = () => {
        setConnected(false)
        if (disposed) return
        reconnectRef.current = window.setTimeout(connect, 2000)
      }
      socket.onerror = () => socket.close()
      socket.onmessage = ({ data }) => {
        try {
          const message = JSON.parse(data)
          const payload = message.payload || {}
          if (payload.metrics) {
            setMetrics({ ...emptyMetrics, ...payload.metrics })
            if (Array.isArray(payload.metrics.devices)) {
              payload.metrics.devices.map(normalizeDevice).filter(Boolean).forEach(mergeDevice)
            }
          }
          if (message.type === 'metrics') {
            setMetrics({ ...emptyMetrics, ...payload })
            if (Array.isArray(payload.devices)) payload.devices.map(normalizeDevice).filter(Boolean).forEach(mergeDevice)
            return
          }
          if (message.type === 'lifecycle') {
            appendEvent(makeEvent(payload.kind, payload.message, payload.deviceName || 'Hardware'))
            if (payload.kind === 'connected' || payload.kind === 'disconnected') {
              triggerAlert(payload.kind === 'connected' ? 'Device connected' : 'Device disconnected', `${payload.deviceName || 'Hardware'}: ${payload.message}`, `chismosa-${payload.kind}-${payload.deviceToken || payload.deviceName || 'device'}`)
            }
            return
          }
          if (message.type === 'device' || message.type === 'heartbeat') {
            const incomingDevices = Array.isArray(payload.devices) ? payload.devices : payload.device ? [payload.device] : []
            incomingDevices.map(normalizeDevice).filter((item) => item?.lastSeen).forEach(mergeDevice)
            const nextDevice = normalizeDevice(payload.device || incomingDevices[0] || payload)
            if (!nextDevice || !nextDevice.lastSeen) return
            const previousStatus = deviceRef.current?.status
            deviceRef.current = nextDevice
            setDevice(nextDevice)
            if (message.type === 'heartbeat') {
              appendEvent(makeEvent('heartbeat', `Heartbeat received · ${nextDevice.status}`, nextDevice.name))
              if (previousStatus && previousStatus !== nextDevice.status) {
                const online = nextDevice.status === 'online'
                appendEvent(makeEvent(online ? 'connected' : 'disconnected', `Device status changed to ${nextDevice.status}`, nextDevice.name))
              }
            }
            return
          }
          if (message.type !== 'update') return

          const nextDevice = payload.device
            ? normalizeDevice(payload.device)
            : deviceRef.current
              ? normalizeDevice({ ...deviceRef.current, status: payload.status || 'online', lastSeen: payload.lastSeen || payload.ts })
              : normalizeDevice({ status: payload.status || 'online', lastSeen: payload.lastSeen || payload.ts })
              if (!nextDevice) return
          const previousStatus = deviceRef.current?.status
          deviceRef.current = nextDevice
          setDevice(nextDevice)
          mergeDevice(nextDevice)
          if (previousStatus && previousStatus !== nextDevice.status) {
            appendEvent(makeEvent(nextDevice.status === 'online' ? 'connected' : 'disconnected', `Device status changed to ${nextDevice.status}`, nextDevice.name))
          }
          const pin = String(payload.pin || '').toUpperCase()
          const reading = Number(payload.value)
          if (pin !== 'V0' || !Number.isFinite(reading)) return

          const readingKey = nextDevice.token || nextDevice.id
          setLiveReadings((current) => ({ ...current, [readingKey]: reading }))
          setTelemetryByDevice((current) => ({
            ...current,
            [readingKey]: {
              ...(current[readingKey] || {}),
              deviceId: nextDevice.id,
              token: nextDevice.token,
              name: nextDevice.name,
              value: reading,
              points: [...(current[readingKey]?.points || []).slice(-31), reading],
            },
          }))
          const triggeredRules = rulesRef.current.filter((rule) => rule.active && Number.isFinite(Number(rule.threshold)) && reading > Number(rule.threshold))
          if (triggeredRules.length) {
            triggeredRules.forEach((rule) => {
              const message = `Automation '${rule.name}' triggered: ${reading} dB exceeded ${rule.threshold} dB`
              appendEvent(makeEvent('warning', message, nextDevice.name))
              triggerAlert(rule.name, `${nextDevice.name}: ${reading} dB exceeded the ${rule.threshold} dB threshold.`, `chismosa-rule-${rule.id}-${readingKey}`)
            })
          } else if (reading > 85) {
            const message = `Decibel Warning: Sensor '${nextDevice.name}' exceeded 85 dB (${reading} dB)`
            appendEvent(makeEvent('warning', message, nextDevice.name))
            triggerAlert('Decibel Warning', `${nextDevice.name}: ${reading} dB exceeded 85 dB.`, `chismosa-decibel-warning-${readingKey}`)
          }
        } catch (_) {
          // Ignore malformed WebSocket frames without interrupting the live connection.
        }
      }
    }

    connect()
    return () => {
      disposed = true
      window.clearTimeout(reconnectRef.current)
      socket?.close()
    }
  }, [])

  return (
    <WebSocketContext.Provider value={{ connected, device, devices, liveReadings, telemetryByDevice, events, setEvents, metrics, renameDevice, rules, setRules, notificationPermission, requestNotificationPermission }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (!context) throw new Error('useWebSocket must be used inside WebSocketProvider')
  return context
}