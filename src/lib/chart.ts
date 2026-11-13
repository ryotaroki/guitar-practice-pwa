import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend)

Chart.defaults.color = '#a1a1aa'
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)'
Chart.defaults.font.family = 'system-ui, -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif'
Chart.defaults.font.size = 11
Chart.defaults.maintainAspectRatio = false
Chart.defaults.animation = { duration: 300 }
Chart.defaults.plugins.tooltip.backgroundColor = '#18181b'
Chart.defaults.plugins.tooltip.borderColor = '#3f3f46'
Chart.defaults.plugins.tooltip.borderWidth = 1
Chart.defaults.plugins.tooltip.padding = 10
Chart.defaults.plugins.legend.labels.boxWidth = 12
Chart.defaults.plugins.legend.labels.boxHeight = 12

export const COLORS = {
  emerald: '#34d399',
  amber: '#fbbf24',
  amberFill: 'rgba(251,191,36,0.32)',
  rose: '#fb7185',
  emeraldFill: 'rgba(52,211,153,0.55)',
}
