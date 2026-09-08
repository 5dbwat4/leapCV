interface ScoreRingProps {
  score: number
  size?: number
  label?: string
}

function scoreColor(score: number): { stroke: string; text: string } {
  if (score >= 75) return { stroke: "text-emerald-500", text: "text-emerald-600" }
  if (score >= 50) return { stroke: "text-primary", text: "text-primary" }
  if (score >= 30) return { stroke: "text-amber-500", text: "text-amber-600" }
  return { stroke: "text-red-500", text: "text-red-600" }
}

/** 环形评分组件（SVG） */
export default function ScoreRing({ score, size = 132, label = "匹配度" }: ScoreRingProps) {
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, score))
  const offset = c * (1 - clamped / 100)
  const { stroke: color, text } = scoreColor(clamped)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={`${color} transition-[stroke-dashoffset] duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold tabular-nums ${text}`}>{clamped}</span>
        {label && <span className="text-xs text-muted-foreground">{label}</span>}
      </div>
    </div>
  )
}
