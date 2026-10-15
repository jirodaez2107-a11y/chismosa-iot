import { createContext, useContext, useEffect, useRef, useState } from 'react'

const WebSocketContext = createContext(null)
const socketUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000'
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function makeEvent(kind, message, device) {
  return {
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    kind,
    message,
    device,
  }
}

function normalizeDevice(source = {}) {
  const name = source.name || source.deviceName || 'ash bahay'
  return {
    ...source,
    id: source.id || `physical-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    token: source.token || source.authToken || '',
    firmware: source.firmware || 'v1.0.0',
    pin: source.pin || 'V0',
    location: source.location || 'jiro',
    status: String(source.status || 'offline').toLowerCase(),
    lastSeen: source.lastSeen || null,
  }
}

export function WebSocketProvider({ children }) {
  const [connected, setConnected] = useState(false)
  const [device, setDevice] = useState(null)
  const [value, setValue] = useState(0)
  const [points, setPoints] = useState([])
  const [events, setEvents] = useState([])
  const reconnectRef = useRef(null)
  const deviceRef = useRef(null)

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
    const connect = () => {
      if (disposed) return
      socket = new WebSocket(socketUrl)
      socket.onopen = () => {
        setConnected(true)
        appendEvent(makeEvent('connected', 'WebSocket connection established', deviceRef.current?.name || 'System'))
      }
      socket.onclose = () => {
        setConnected(false)
        if (disposed) return
        appendEvent(makeEvent('disconnected', 'WebSocket connection lost', deviceRef.current?.name || 'System'))
        reconnectRef.current = window.setTimeout(connect, 2000)
      }
      socket.onerror = () => socket.close()
      socket.onmessage = ({ data }) => {
        try {
          const message = JSON.parse(data)
          const payload = message.payload || {}
          if (message.type === 'device' || message.type === 'heartbeat') {
            const nextDevice = normalizeDevice(payload.device || payload)
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
          const previousStatus = deviceRef.current?.status
          deviceRef.current = nextDevice
          setDevice(nextDevice)
          if (previousStatus && previousStatus !== nextDevice.status) {
            appendEvent(makeEvent(nextDevice.status === 'online' ? 'connected' : 'disconnected', `Device status changed to ${nextDevice.status}`, nextDevice.name))
          }
          const pin = String(payload.pin || '').toUpperCase()
          const reading = Number(payload.value)
          if (pin !== 'V0' || !Number.isFinite(reading)) return

          setValue(reading)
          setPoints((current) => [...current.slice(-31), reading])
          if (reading > 85) {
            appendEvent(makeEvent('warning', `Decibel Warning: Sensor '${nextDevice.name}' exceeded 85 dB (${reading} dB)`, nextDevice.name))
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
    <WebSocketContext.Provider value={{ connected, device, value, points, events, setEvents, renameDevice }}>
      {children}
    </WebSocketContext.Provider>
  )
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (!context) throw new Error('useWebSocket must be used inside WebSocketProvider')
  return context
}