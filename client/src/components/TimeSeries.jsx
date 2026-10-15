import React from 'react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js'
import 'chartjs-adapter-date-fns'
ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

export default function TimeSeries({ data = [] }) {
  const chartData = {
    datasets: [
      {
        label: 'Noise (dB)',
        data: data.map(d => ({ x: d.x, y: d.y })),
        borderColor: '#60a5fa',
        backgroundColor: 'rgba(96,165,250,0.2)'
      }
    ]
  }

  const options = {
    scales: {
      x: { type: 'time', time: { unit: 'second' }, ticks: { color: '#cbd5e1' } },
      y: { min: 0, max: 500, ticks: { color: '#cbd5e1' } }
    },
    plugins: { legend: { display: false } },
    responsive: true,
    maintainAspectRatio: false
  }

  return (
    <div style={{ height: 240 }}>
      <Line data={chartData} options={options} />
    </div>
  )
}
