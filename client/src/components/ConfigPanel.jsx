import React, { useState } from 'react'

export default function ConfigPanel({ onStartMock, onStopMock, device }) {
  const [pin, setPin] = useState('V0')
  const [min, setMin] = useState(0)
  const [max, setMax] = useState(500)
  const [type, setType] = useState('Double')

  return (
    <div>
      <h3 className="font-semibold">Data Stream Config</h3>
      <div className="mt-2 text-sm text-slate-300 space-y-2">
        <div>
          <label className="block text-xs">Virtual Pin</label>
          <input value={pin} onChange={e => setPin(e.target.value)} className="w-full bg-slate-700 p-2 rounded text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs">Min</label>
            <input type="number" value={min} onChange={e => setMin(Number(e.target.value))} className="w-full bg-slate-700 p-2 rounded text-sm" />
          </div>
          <div>
            <label className="block text-xs">Max</label>
            <input type="number" value={max} onChange={e => setMax(Number(e.target.value))} className="w-full bg-slate-700 p-2 rounded text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs">Type</label>
          <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-slate-700 p-2 rounded text-sm">
            <option>Double</option>
            <option>Integer</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button onClick={onStartMock} className="bg-emerald-500 px-3 py-1 rounded">Start Mock</button>
          <button onClick={onStopMock} className="bg-red-500 px-3 py-1 rounded">Stop Mock</button>
        </div>

        <div className="text-xs text-slate-400">
          Generate device code and copy it to your ESP project using the backend code export endpoint.
        </div>
      </div>
    </div>
  )
}
