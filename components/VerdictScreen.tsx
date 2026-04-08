'use client'
import { useEffect, useState } from 'react'
import type { SimConfig, Verdict, CoreCriterion, CaseSpecificCriterion } from '@/lib/types'
import { exportToPDF } from '@/lib/pdf-export'
import { makeSessionPublic } from '@/lib/supabase-sessions'
import styles from './VerdictScreen.module.css'

interface Props { verdict: Verdict; config: SimConfig; onRestart: () => void; backLabel?: string; sessionId?: string }

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
    <div className={styles.barRow}>
      <div className={styles.barBg}>
        <div className={styles.barFill} style={{ width: animated ? `${pct}%` : '0%' }} />
      </div>
      <span className={styles.barScore}>
        <strong>{score}</strong><span className={styles.barOf}>&thinsp;/&thinsp;5</span>
      </span>
    </div>
  )
}

export default function VerdictScreen({ verdict, config, onRestart, backLabel, sessionId }: Props) {
  const [animated, setAnimated] = useState(false)
  const [shareLabel, setShareLabel] = useState('🔗 Share Replay')
  useEffect(() => { setTimeout(() => setAnimated(true), 300) }, [])

  const totalPct    = Math.min(100, Math.max(0, verdict.totalScore))
  const sessionTitle = config.sessionName || config.ideaDocName || 'Session'

  const handleExportPDF = () => exportToPDF(verdict, config, sessionTitle)

  const handleShareReplay = async () => {
    if (!sessionId) return
    try {
      const url = await makeSessionPublic(sessionId)
      await navigator.clipboard.writeText(url)
      setShareLabel('✓ Copied!')
      setTimeout(() => setShareLabel('🔗 Share Replay'), 2000)
    } catch (e) {
      console.error('shareReplay error:', e)
    }
  }

  return (
    <div className={styles.wrap}>

      {/* ── Top bar ── */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <button className={styles.restartBtn} onClick={onRestart}>{backLabel ?? '← New session'}</button>
          <span className={styles.topBarTitle}>
            {sessionTitle}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          {sessionId && (
            <button className={styles.shareBtn} onClick={handleShareReplay}>
              {shareLabel}
            </button>
          )}
          <button className={styles.pdfBtn} onClick={handleExportPDF}>
            ↓ Export PDF
          </button>
        </div>
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
            {config.sessionDescription && (
              <div className={styles.heroDesc}>{config.sessionDescription}</div>
            )}
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
              <span>Core Score</span>
              <span className={styles.scoringValue}>
                {verdict.coreScore}<span className={styles.scoringOf}>&thinsp;/&thinsp;75</span>
              </span>
            </div>
            <div className={styles.scoringRow}>
              <span>Case-Specific Score</span>
              <span className={styles.scoringValue}>
                {verdict.caseSpecificScore}<span className={styles.scoringOf}>&thinsp;/&thinsp;25</span>
              </span>
            </div>
            <div className={`${styles.scoringRow} ${styles.scoringTotal}`}>
              <span>Total Score</span>
              <span className={styles.scoringValue}>
                {verdict.totalScore}<span className={styles.scoringOf}>&thinsp;/&thinsp;100</span>
              </span>
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
          <button className={styles.newSessionBtn} style={{ borderColor: '#000', color: '#000' }} onClick={handleExportPDF}>
            ↓ Export as PDF
          </button>
          <p className={styles.footerNote}>
            Powered by Outbindr — Universal Panel Evaluation Report
          </p>
        </div>

      </div>
    </div>
  )
}
