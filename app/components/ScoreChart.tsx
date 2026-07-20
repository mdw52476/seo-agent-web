'use client'
import { useEffect, useRef } from 'react'

interface AuditPoint { score: number; audited_at: string }

function fmt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ScoreChart({ audits, height = 256 }: { audits: AuditPoint[]; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<any>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    let Chart: any
    import('chart.js/auto').then(mod => {
      Chart = mod.default
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
      if (!canvasRef.current) return

      const labels = audits.map(a => fmt(a.audited_at))
      const data   = audits.map(a => a.score)

      chartRef.current = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'SEO Score',
            data,
            borderColor: '#111827',
            backgroundColor: 'rgba(17,24,39,0.06)',
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.3,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx: any) => ` Score: ${ctx.parsed.y}`,
              },
            },
          },
          scales: {
            y: {
              min: 0, max: 100,
              ticks: { stepSize: 20, color: '#9ca3af', font: { size: 11 } },
              grid: { color: '#f3f4f6' },
            },
            x: {
              ticks: { color: '#9ca3af', font: { size: 11 }, maxTicksLimit: 10 },
              grid: { display: false },
            },
          },
        },
      })
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [audits])

  if (audits.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-sm text-gray-400">
        No audit data yet — run an audit to start tracking score over time.
      </div>
    )
  }

  return <div style={{ height }} className="relative"><canvas ref={canvasRef} /></div>
}
