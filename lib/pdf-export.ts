import type { Verdict, SimConfig } from './types'

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
  exceptional: 'Exceptional — Top Tier',
  strong:      'Strong',
  competitive: 'Competitive',
  average:     'Average',
  below:       'Below Expectations',
}

function scoreBar(score: number): string {
  const filled = Math.round((score / 5) * 20)
  return `${'█'.repeat(filled)}${'░'.repeat(20 - filled)}`
}

export function exportToPDF(verdict: Verdict, config: SimConfig, sessionTitle?: string) {
  const title = sessionTitle || config.sessionName || config.ideaDocName || 'Session'
  const date  = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const panelNames = (config.panelists ?? []).map(p => `${p.name} — ${p.role}`).join('<br>')

  const coreRows = CORE_CRITERIA.map(({ key, label, weight }) => {
    const c = verdict.core?.[key] ?? { score: 0, notes: '' }
    return `
      <tr>
        <td class="label">${label}</td>
        <td class="weight">${weight}%</td>
        <td class="bar"><span class="bar-track"><span class="bar-fill" style="width:${(c.score/5)*100}%"></span></span></td>
        <td class="score">${c.score} <span class="of">/ 5</span></td>
      </tr>
      ${c.notes ? `<tr class="notes-row"><td colspan="4" class="notes">${c.notes}</td></tr>` : ''}
    `
  }).join('')

  const caseRows = (verdict.caseSpecific?.criteria ?? []).map(c => `
    <tr>
      <td class="label">${c.name}</td>
      <td class="weight">${c.weight}%</td>
      <td class="bar"><span class="bar-track"><span class="bar-fill" style="width:${(c.score/5)*100}%"></span></span></td>
      <td class="score">${c.score} <span class="of">/ 5</span></td>
    </tr>
    ${c.notes ? `<tr class="notes-row"><td colspan="4" class="notes">${c.notes}</td></tr>` : ''}
  `).join('')

  const strengths = (verdict.summary?.topStrengths ?? []).map(s => `<li>${s}</li>`).join('')
  const improvements = (verdict.summary?.areasForImprovement ?? []).map(s => `<li>${s}</li>`).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Outbindr Sim: ${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', 'Courier', monospace;
    background: #fff; color: #000;
    font-size: 11px; line-height: 1.6;
    padding: 40px 48px;
  }

  /* ── Cover header ── */
  .cover {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 28px;
  }
  .cover-left {}
  .brand { font-size: 10px; letter-spacing: 0.18em; color: #888; margin-bottom: 6px; }
  .session-title { font-size: 22px; font-weight: 700; color: #000; line-height: 1.2; }
  .session-desc { font-size: 11px; color: #555; margin-top: 6px; }
  .cover-right { text-align: right; }
  .cover-date { font-size: 10px; color: #888; }
  .cover-score {
    font-size: 48px; font-weight: 700; line-height: 1; color: #000; margin-top: 4px;
  }
  .cover-score span { font-size: 16px; color: #888; font-weight: 400; }
  .cover-tier { font-size: 11px; color: #555; margin-top: 4px; }

  /* ── Panel ── */
  .panel-section { margin-bottom: 24px; }
  .panel-list { font-size: 10px; color: #555; line-height: 2; }

  /* ── Section headers ── */
  .section-header {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
    color: #888; border-bottom: 1px solid #e0e0e0;
    padding-bottom: 5px; margin-bottom: 14px; margin-top: 28px;
  }

  /* ── Score tables ── */
  table { width: 100%; border-collapse: collapse; }
  td { padding: 5px 0; vertical-align: middle; }
  td.label { font-size: 11px; color: #000; width: 38%; }
  td.weight { font-size: 9px; color: #aaa; width: 6%; text-align: right; }
  td.bar { width: 38%; padding: 0 12px; }
  td.score { font-size: 12px; font-weight: 700; color: #000; width: 10%; text-align: right; white-space: nowrap; }
  td.score .of { font-size: 9px; font-weight: 400; color: #aaa; }
  tr + tr td { border-top: 1px solid #f5f5f5; }
  td.notes { font-size: 10px; color: #666; padding: 3px 0 8px 0; border-top: none; font-style: italic; }
  tr.notes-row td { border-top: none; }

  .bar-track {
    display: block; width: 100%; height: 6px;
    background: #f0f0f0; border-radius: 3px; overflow: hidden;
  }
  .bar-fill {
    display: block; height: 100%; background: #000; border-radius: 3px;
  }

  /* ── Summary ── */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 16px; }
  .summary-box { border: 1px solid #e0e0e0; padding: 14px; }
  .summary-box-title { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: #aaa; margin-bottom: 8px; }
  .summary-box ul { padding-left: 14px; }
  .summary-box li { font-size: 11px; color: #333; margin-bottom: 4px; }
  .callout-box { border: 1px solid #e0e0e0; padding: 14px; margin-bottom: 12px; }
  .callout-box.risk { border-color: #f5c0c0; background: #fff8f8; }
  .callout-label { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: #aaa; margin-bottom: 6px; }
  .callout-box p { font-size: 11px; color: #444; line-height: 1.6; }

  /* ── Context ── */
  .context-box { border: 1px solid #e8e8e8; padding: 14px; margin-bottom: 10px; background: #fafafa; }
  .context-label { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: #aaa; margin-bottom: 6px; }
  .context-box p { font-size: 11px; color: #555; line-height: 1.65; }

  /* ── Final scoring ── */
  .score-table { border: 1px solid #e0e0e0; width: 100%; margin-bottom: 16px; }
  .score-table td { padding: 10px 16px; font-size: 11px; border-bottom: 1px solid #f0f0f0; }
  .score-table .val { font-size: 16px; font-weight: 700; text-align: right; }
  .score-table tr:last-child td { border-bottom: none; font-weight: 600; background: #f8f8f8; }
  .rec-block { background: #000; color: #fff; padding: 16px 20px; }
  .rec-label { font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; color: #888; margin-bottom: 4px; }
  .rec-value { font-size: 18px; font-weight: 700; }

  /* ── Footer ── */
  .doc-footer {
    margin-top: 40px; padding-top: 14px; border-top: 1px solid #e0e0e0;
    display: flex; justify-content: space-between;
    font-size: 9px; color: #bbb; letter-spacing: 0.06em;
  }

  @media print {
    body { padding: 24px 32px; }
    @page { margin: 16mm; size: A4; }
  }
</style>
</head>
<body>

<!-- ── Cover ── -->
<div class="cover">
  <div class="cover-left">
    <div class="brand">OUTBINDR — UNIVERSAL PANEL EVALUATION REPORT</div>
    <div class="session-title">${title}</div>
    ${config.sessionDescription ? `<div class="session-desc">${config.sessionDescription}</div>` : ''}
  </div>
  <div class="cover-right">
    <div class="cover-date">${date}</div>
    <div class="cover-score">${verdict.totalScore}<span>/100</span></div>
    <div class="cover-tier">${TIER_LABELS[verdict.recommendation] ?? verdict.recommendation}</div>
  </div>
</div>

<!-- ── Panel ── -->
${panelNames ? `
<div class="panel-section">
  <div class="section-header"><span>Evaluation Panel</span><span>${config.panelists.length} judges</span></div>
  <div class="panel-list">${panelNames}</div>
</div>
` : ''}

<!-- ── Core evaluation ── -->
<div class="section-header">
  <span>Core Evaluation</span>
  <span>75 pts · Score: ${verdict.coreScore}/75</span>
</div>
<table>${coreRows}</table>

<!-- ── Case-specific ── -->
<div class="section-header">
  <span>Case-Specific Evaluation</span>
  <span>25 pts · Score: ${verdict.caseSpecificScore}/25</span>
</div>
${verdict.caseSpecific?.justification ? `
<div class="context-box">
  <div class="context-label">Evaluator Justification</div>
  <p>${verdict.caseSpecific.justification}</p>
</div>` : ''}
${verdict.caseSpecific?.contextPerformance ? `
<div class="context-box">
  <div class="context-label">Context Performance</div>
  <p>${verdict.caseSpecific.contextPerformance}</p>
</div>` : ''}
<table>${caseRows}</table>

<!-- ── Summary ── -->
<div class="section-header"><span>Final Summary</span></div>
<div class="two-col">
  <div class="summary-box">
    <div class="summary-box-title">Top Strengths</div>
    <ul>${strengths}</ul>
  </div>
  <div class="summary-box">
    <div class="summary-box-title">Areas for Improvement</div>
    <ul>${improvements}</ul>
  </div>
</div>
<div class="callout-box">
  <div class="callout-label">Standout Moment</div>
  <p>${verdict.summary?.standoutMoment ?? '—'}</p>
</div>
<div class="callout-box risk">
  <div class="callout-label">Biggest Risk / Concern</div>
  <p>${verdict.summary?.biggestRisk ?? '—'}</p>
</div>

<!-- ── Final scoring ── -->
<div class="section-header"><span>Final Scoring</span></div>
<table class="score-table">
  <tr><td>Core Score</td><td class="val">${verdict.coreScore} <span style="font-size:10px;font-weight:400;color:#888">/ 75</span></td></tr>
  <tr><td>Case-Specific Score</td><td class="val">${verdict.caseSpecificScore} <span style="font-size:10px;font-weight:400;color:#888">/ 25</span></td></tr>
  <tr><td>Total Score</td><td class="val">${verdict.totalScore} <span style="font-size:10px;font-weight:400;color:#888">/ 100</span></td></tr>
</table>
<div class="rec-block">
  <div class="rec-label">Final Recommendation</div>
  <div class="rec-value">${TIER_LABELS[verdict.recommendation] ?? verdict.recommendation}</div>
</div>

<!-- ── Footer ── -->
<div class="doc-footer">
  <span>OUTBINDR · outbindr.com</span>
  <span>Generated ${date}</span>
</div>

<script>window.onload = () => { window.print() }<\/script>
</body>
</html>`

  const w = window.open('', '_blank')
  if (w) {
    w.document.write(html)
    w.document.close()
  }
}
