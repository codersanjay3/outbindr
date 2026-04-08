'use client'
import type { Panelist } from '@/lib/types'
import styles from './AgentGraph.module.css'

export interface GraphEdge {
  from: string
  to: string
  active: boolean
}

interface Props {
  panelists: Panelist[]
  activePanelist: string | null
  edges: GraphEdge[]
}

const W = 200
const H = 160

export default function AgentGraph({ panelists, activePanelist, edges }: Props) {
  const n = panelists.length
  if (n === 0) return null

  const cx = W / 2
  const cy = H / 2 + 4
  // Tighter radius for small panels, wider for large
  const r = n <= 2 ? 52 : n <= 3 ? 48 : 44

  const positions = panelists.map((p, i) => ({
    p,
    x: cx + r * Math.cos((2 * Math.PI * i) / n - Math.PI / 2),
    y: cy + r * Math.sin((2 * Math.PI * i) / n - Math.PI / 2),
  }))

  const posMap: Record<string, { x: number; y: number }> = {}
  positions.forEach(({ p, x, y }) => { posMap[p.name] = { x, y } })

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>⬡ Agent Network</div>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className={styles.svg}
        aria-hidden="true"
      >
        {/* Background edges (all pairs as faint lines) */}
        {panelists.flatMap((a, ai) =>
          panelists.slice(ai + 1).map((b) => {
            const pa = posMap[a.name]
            const pb = posMap[b.name]
            return (
              <line
                key={`bg-${a.name}-${b.name}`}
                x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={0.5}
              />
            )
          })
        )}

        {/* Active edges — lit when one panelist referenced another */}
        {edges.map((e, i) => {
          const pa = posMap[e.from]
          const pb = posMap[e.to]
          if (!pa || !pb) return null
          return (
            <line
              key={`edge-${i}`}
              x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              stroke={e.active ? '#c8962a' : 'rgba(200,150,42,0.18)'}
              strokeWidth={e.active ? 1.5 : 0.75}
              className={e.active ? styles.edgeActive : undefined}
            />
          )
        })}

        {/* Nodes */}
        {positions.map(({ p, x, y }) => {
          const isActive = p.name === activePanelist
          return (
            <g key={p.name}>
              {/* Outer pulse ring for active speaker */}
              {isActive && (
                <circle
                  cx={x} cy={y} r={20}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={1}
                  className={styles.pulse}
                />
              )}

              {/* Node body */}
              <circle
                cx={x} cy={y}
                r={isActive ? 14 : 10}
                fill={p.bg}
                stroke={isActive ? p.color : (p.bd || '#333')}
                strokeWidth={isActive ? 2 : 1}
                style={{ transition: 'r 0.3s, stroke-width 0.3s' }}
              />

              {/* Avatar emoji */}
              <text
                x={x} y={y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={isActive ? 12 : 9}
                style={{ userSelect: 'none', transition: 'font-size 0.3s' }}
              >
                {p.avatar}
              </text>

              {/* Name label */}
              <text
                x={x} y={y + (isActive ? 24 : 19)}
                textAnchor="middle"
                fontSize={7}
                fontFamily="DM Mono, monospace"
                fill={isActive ? p.color : 'rgba(255,255,255,0.3)'}
                style={{ transition: 'fill 0.3s' }}
              >
                {p.name.split(' ')[0]}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
