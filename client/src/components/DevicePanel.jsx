import React from 'react'

export default function DevicePanel({ device }) {
  if (!device) return <div>Loading device...</div>
  return (
    <div>
      <h3 className="font-semibold">Device Info</h3>
      <div className="mt-2 text-sm text-slate-300 space-y-1">
        <div><strong>Template:</strong> {device.templateId}</div>
        <div><strong>Name:</strong> {device.deviceName}</div>
        <div><strong>Wi-Fi:</strong> {device.wifi?.status} ({device.wifi?.ssid})</div>
        <div><strong>Auth Token:</strong> {device.authToken}</div>
      </div>
    </div>
  )
}
