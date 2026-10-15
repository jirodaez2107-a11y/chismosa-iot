import React from 'react'
import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
ChartJS.register(ArcElement, Tooltip)

export default function Gauge({ value = 0, min = 0, max = 500 }) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
  const angle = Math.round(pct * 100);

  const data = {
    datasets: [
      {
        data: [pct * 100, 100 - pct * 100],
        backgroundColor: ['#10b981', '#334155'],
        borderWidth: 0,
        cutout: '75%'
      }
    ]
  }

  const options = { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { enabled: false } } }

  return (
    <div style={{ width: 200, height: 200 }}>
      <Doughnut data={data} options={options} />
      <div style={{ position: 'relative', top: -140, textAlign: 'center' }}>
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-sm text-slate-400">dB</div>
      </div>
    </div>
  )
}
