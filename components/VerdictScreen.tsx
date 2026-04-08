'use client'
import { useEffect, useState } from 'react'
import type { SimConfig, Verdict, CoreCriterion, CaseSpecificCriterion } from '@/lib/types'
import styles from './VerdictScreen.module.css'

interface Props { verdict: Verdict; config: SimConfig; onRestart: () => void; backLabel?: string }

const CORE_CRITERIA: { key: keyof Verdict['core']; label: string; weight: number }[] = [
  { key: 'communicationSkills',    label: 'Communication Skills',     weight: 15 },
  { key: 'criticalThinking',       label: 'Critical Thinking',        weight: 15 },
  { key: 'subjectMastery',         label: 'Subject Mastery',          weight: 15 },
  { key: 'confidencePresence',     label: 'Confidence & Presence',    weight: 10 },
  { key: 'adaptability',           label: 'Adaptability',             weight: 10 },
  { key: 'composureUnderPressure', label: 'Composure Under Pressure', weight: 10 },
  { key: 'authenticity',           label: 'Authenticity',             weight:  5 },
  { key: 'engagementInteraction',  label: 'Engagement & Interaction', weight:  5 },
  { key: 'problemSolvingAbility',  label: 'Problem-Solving Ability',  weight: 10 },
  { key: 'overallImpact',          label: 'Overall Impact',           weight:  5 },
]

const TIER_LABELS: Record<string, string> = {
  exceptional:  'Exceptional — Top Tier',
  strong:       'Strong',
  competitive:  'Competitive',
  average:      'Average',
  below:        'Below Expectations',
}

function ScoreBar({ score, animated }: { score: number; animated: boolean }) {
  const pct = Math.min(100, Math.max(0, (score / 5) * 100))
  return (
    <div className={styles.barBg}>
      <div className={styles.barFill} style={{ width: animated ? `${pct}%` : '0%' }} />
      <span className={styles.barScore}>{score}/5</span>
    </div>
  )
}

export default function VerdictScreen({ verdict, config, onRestart, backLabel }: Props) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { setTimeout(() => setAnimated(true), 300) }, [])

  const totalPct = Math.min(100, Math.max(0, verdict.totalScore))

  return (
    <div className={styles.wrap}>

      {/* ── Top bar ── */}
      <header className={styles.topBar}>
        <span className={styles.topBarTitle}>Universal Panel Evaluation Report</span>
        <button className={styles.restartBtn} onClick={onRestart}>{backLabel ?? '← New session'}</button>
      </header>

      <div className={styles.scroll}>

        {/* ── Hero score ── */}
        <section className={styles.hero}>
          <div className={styles.heroScore}>
            <div
              className={styles.heroRing}
              style={{ '--pct': `${animated ? totalPct : 0}%` } as React.CSSProperties}
            >
              <span className={styles.heroNum}>{verdict.totalScore}</span>
              <span className={styles.heroOf}>/100</span>
            </div>
          </div>
          <div className={styles.heroMeta}>
            <div className={styles.heroTier}>{TIER_LABELS[verdict.recommendation] ?? verdict.recommendation}</div>
            <div className={styles.heroBreakdown}>
              <span>Core <strong>{verdict.coreScore}</strong>/75</span>
              <span className={styles.heroDivider}>·</span>
              <span>Case-specific <strong>{verdict.caseSpecificScore}</strong>/25</span>
            </div>
          </div>
        </section>

        {/* ── Core evaluation ── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Core Evaluation</span>
            <span className={styles.sectionWeight}>75%</span>
          </div>

          <div className={styles.coreGrid}>
            {CORE_CRITERIA.map(({ key, label, weight }) => {
              const c: CoreCriterion = verdict.core?.[key] ?? { score: 0, notes: '' }
              return (
                <div key={key} className={styles.coreItem}>
                  <div className={styles.coreTop}>
                    <span className={styles.coreLabel}>{label}</span>
                    <span className={styles.coreWeight}>{weight}%</span>
                  </div>
                  <ScoreBar score={c.score} animated={animated} />
                  {c.notes && <p className={styles.coreNotes}>{c.notes}</p>}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Case-specific evaluation ── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Case-Specific Evaluation</span>
            <span className={styles.sectionWeight}>25%</span>
          </div>

          {verdict.caseSpecific?.justification && (
            <div className={styles.caseJustification}>
              <div className={styles.caseJLabel}>Evaluator justification</div>
              <p>{verdict.caseSpecific.justification}</p>
            </div>
          )}

          {verdict.caseSpecific?.contextPerformance && (
            <div className={styles.caseContext}>
              <div className={styles.caseJLabel}>Context performance</div>
              <p>{verdict.caseSpecific.contextPerformance}</p>
            </div>
          )}

          <div className={styles.caseGrid}>
            {(verdict.caseSpecific?.criteria ?? []).map((c: CaseSpecificCriterion, i: number) => (
              <div key={i} className={styles.caseItem}>
                <div className={styles.coreTop}>
                  <span className={styles.coreLabel}>{c.name}</span>
                  <span className={styles.coreWeight}>{c.weight}%</span>
                </div>
                <ScoreBar score={c.score} animated={animated} />
                {c.notes && <p className={styles.coreNotes}>{c.notes}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* ── Final summary ── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Final Summary</span>
          </div>

          <div className={styles.summaryGrid}>
            <div className={styles.summaryBlock}>
              <div className={styles.summaryBlockTitle}>Top Strengths</div>
              <ul className={styles.summaryList}>
                {(verdict.summary?.topStrengths ?? []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            <div className={styles.summaryBlock}>
              <div className={styles.summaryBlockTitle}>Areas for Improvement</div>
              <ul className={styles.summaryList}>
                {(verdict.summary?.areasForImprovement ?? []).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className={styles.summaryRow}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryCardLabel}>Standout Moment</div>
              <p>{verdict.summary?.standoutMoment ?? '—'}</p>
            </div>
            <div className={`${styles.summaryCard} ${styles.summaryCardRisk}`}>
              <div className={styles.summaryCardLabel}>Biggest Risk / Concern</div>
              <p>{verdict.summary?.biggestRisk ?? '—'}</p>
            </div>
          </div>
        </section>

        {/* ── Final scoring table ── */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Final Scoring</span>
          </div>

          <div className={styles.scoringTable}>
            <div className={styles.scoringRow}>
              <span>Core Score (out of 75)</span>
              <span className={styles.scoringValue}>{verdict.coreScore}</span>
            </div>
            <div className={styles.scoringRow}>
              <span>Case-Specific Score (out of 25)</span>
              <span className={styles.scoringValue}>{verdict.caseSpecificScore}</span>
            </div>
            <div className={`${styles.scoringRow} ${styles.scoringTotal}`}>
              <span>Total Score (out of 100)</span>
              <span className={styles.scoringValue}>{verdict.totalScore}</span>
            </div>
          </div>

          <div className={styles.recBlock}>
            <div className={styles.recLabel}>Final Recommendation</div>
            <div className={styles.recValue}>{TIER_LABELS[verdict.recommendation] ?? verdict.recommendation}</div>
          </div>
        </section>

        <div className={styles.footer}>
          <button className={styles.newSessionBtn} onClick={onRestart}>
            Run Another Session ↗
          </button>
          <p className={styles.footerNote}>
            Powered by PitchWars — Universal Panel Evaluation Report
          </p>
        </div>

      </div>
    </div>
  )
}
