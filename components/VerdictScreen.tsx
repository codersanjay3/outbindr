'use client'
import { useEffect, useState } from 'react'
import type { SimConfig, Verdict } from '@/lib/types'
import styles from './VerdictScreen.module.css'

interface Props { verdict: Verdict; config: SimConfig; onRestart: () => void }

const STANCE_LABEL: Record<string, string> = {
  approve: '✓ Approve', reject: '✗ Reject', conditional: '◎ Conditional',
}
const STANCE_COLOR: Record<string, string> = {
  approve: '#50a040', reject: '#c04040', conditional: '#c8962a',
}

export default function VerdictScreen({ verdict, config, onRestart }: Props) {
  const [scored, setScored] = useState(false)
  useEffect(() => { setTimeout(() => setScored(true), 400) }, [])

  const getP = (name: string, i: number) =>
    config.panelists.find(p => p.name === name) ?? config.panelists[i] ?? config.panelists[0]

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <span className={styles.headerTitle}>Session Report</span>
        <button className={styles.ghostBtn} onClick={onRestart}>← New session</button>
      </header>

      <div className={styles.content}>

        {/* Overall */}
        <div className={styles.overallBlock}>
          <div className={styles.overallNum}>{verdict.overall}</div>
          <div className={styles.overallLabel}>OVERALL SCORE / 100</div>
          <p className={styles.overallVerdict}>"{verdict.verdict}"</p>
        </div>

        {/* Panelist breakdown */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Panelist Breakdown</h2>
          {verdict.members.map((m, i) => {
            const p = getP(m.name, i)
            return (
              <div key={i} className={styles.memberCard}>
                <div className={styles.mHeader}>
                  <div className={styles.mAvatar} style={{ background: p.bg, borderColor: p.bd }}>{p.avatar}</div>
                  <div className={styles.mMeta}>
                    <span className={styles.mName} style={{ color: p.color }}>{m.name}</span>
                    <span className={styles.mStance} style={{ color: STANCE_COLOR[m.stance] ?? '#c8962a' }}>
                      {STANCE_LABEL[m.stance] ?? m.stance}
                    </span>
                  </div>
                  <span className={styles.mScore}>{m.score}/100</span>
                </div>
                <div className={styles.mBarBg}>
                  <div className={styles.mBar} style={{ width: scored ? `${m.score}%` : '0%', background: p.color }} />
                </div>
                <p className={styles.mSummary}>"{m.summary}"</p>
                {m.keyQuotes?.length > 0 && (
                  <div className={styles.quotes}>
                    {m.keyQuotes.map((q, qi) => (
                      <div key={qi} className={styles.quote} style={{ borderLeftColor: p.color + '60' }}>"{q}"</div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </section>

        {/* Strengths & Concerns */}
        <div className={styles.twoCol}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle} style={{ color: '#50a040' }}>Strengths</h2>
            <ul className={styles.list}>
              {verdict.strengths?.map((s, i) => <li key={i} className={styles.listItem}>{s}</li>)}
            </ul>
          </section>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle} style={{ color: '#c04040' }}>Concerns</h2>
            <ul className={styles.list}>
              {verdict.concerns?.map((c, i) => <li key={i} className={styles.listItem}>{c}</li>)}
            </ul>
          </section>
        </div>

        {/* Recommendations */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Recommendations</h2>
          <ol className={styles.orderedList}>
            {verdict.recommendations?.map((r, i) => <li key={i} className={styles.listItem}>{r}</li>)}
          </ol>
        </section>

        <button className={styles.restartBtn} onClick={onRestart}>RUN ANOTHER SESSION ↗</button>
      </div>
    </div>
  )
}
