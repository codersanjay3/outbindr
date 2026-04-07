'use client'
import styles from './PanelGuideModal.module.css'

interface Props { onClose: () => void }

export default function PanelGuideModal({ onClose }: Props) {
  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>

        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.title}>Panel Document Guide</span>
            <span className={styles.subtitle}>How to write a strong judge panel doc</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.disclaimer}>
          <span className={styles.disclaimerIcon}>ⓘ</span>
          <span>
            This is a starting point — feel free to ignore, reorder, or completely
            rewrite any of it. <strong>Only your uploaded document controls how the panel
            behaves.</strong> Nothing here is enforced.
          </span>
        </div>

        <div className={styles.body}>

          <section className={styles.section}>
            <div className={styles.sectionNum}>01</div>
            <div className={styles.sectionContent}>
              <h3 className={styles.sectionTitle}>Panel Composition</h3>
              <p className={styles.sectionDesc}>Who they are — aim for different perspectives, not more heads.</p>
              <ul className={styles.list}>
                <li>2–6 members is the sweet spot (keeps it realistic)</li>
                <li>Mix backgrounds: technical, strategic, user-focused, execution-focused</li>
                <li>Each person should evaluate something the others don't</li>
              </ul>
              <div className={styles.example}>
                <span className={styles.exampleLabel}>EXAMPLE MIX</span>
                <span className={styles.tag}>Big-picture thinker</span>
                <span className={styles.tag}>Technical expert</span>
                <span className={styles.tag}>Execution judge</span>
                <span className={styles.tag}>Skeptic</span>
                <span className={styles.tag}>Impact evaluator</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionNum}>02</div>
            <div className={styles.sectionContent}>
              <h3 className={styles.sectionTitle}>Identity</h3>
              <p className={styles.sectionDesc}>Name + role — make them feel like real people, not archetypes.</p>
              <ul className={styles.list}>
                <li>Name: simple, realistic</li>
                <li>Role: 1 line, should directly shape how they judge</li>
                <li>Background: optional, but adds depth</li>
              </ul>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionNum}>03</div>
            <div className={styles.sectionContent}>
              <h3 className={styles.sectionTitle}>Personality</h3>
              <p className={styles.sectionDesc}>How they interact. This is what makes the panel feel real.</p>
              <ul className={styles.list}>
                <li>Give each person a distinct style — no two should react the same way</li>
                <li>Define how they ask questions (blunt? curious? methodical?)</li>
              </ul>
              <div className={styles.example}>
                <span className={styles.exampleLabel}>PERSONALITY TYPES</span>
                <span className={styles.tag}>Direct / blunt</span>
                <span className={styles.tag}>Analytical</span>
                <span className={styles.tag}>Curious / probing</span>
                <span className={styles.tag}>Supportive but critical</span>
                <span className={styles.tag}>Skeptical</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionNum}>04</div>
            <div className={styles.sectionContent}>
              <h3 className={styles.sectionTitle}>Evaluation Focus</h3>
              <p className={styles.sectionDesc}>What each judge cares about — 2–4 priorities per person.</p>
              <ul className={styles.list}>
                <li>Tie directly to their role — not generic like "good idea"</li>
                <li>Avoid overlap across judges</li>
              </ul>
              <div className={styles.example}>
                <span className={styles.exampleLabel}>FOCUS EXAMPLES</span>
                <span className={styles.tag}>Technical feasibility</span>
                <span className={styles.tag}>Clarity</span>
                <span className={styles.tag}>Innovation</span>
                <span className={styles.tag}>Real-world applicability</span>
                <span className={styles.tag}>Execution ability</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionNum}>05</div>
            <div className={styles.sectionContent}>
              <h3 className={styles.sectionTitle}>Red Flags & Green Flags</h3>
              <p className={styles.sectionDesc}>The most important part — it makes them feel like real evaluators.</p>
              <div className={styles.flagGrid}>
                <div className={styles.flagCol}>
                  <span className={styles.flagLabel}>GREEN FLAGS</span>
                  <ul className={styles.list}>
                    <li>Clear reasoning</li>
                    <li>Specific examples</li>
                    <li>Confidence backed by logic</li>
                  </ul>
                </div>
                <div className={styles.flagCol}>
                  <span className={styles.flagLabel} style={{ color: '#c04040' }}>RED FLAGS</span>
                  <ul className={styles.list}>
                    <li>Vagueness</li>
                    <li>Overconfidence without proof</li>
                    <li>Avoiding direct questions</li>
                  </ul>
                </div>
              </div>
              <p className={styles.note}>Tie these to personality — an analytical judge hates missing data; a skeptic hates hype.</p>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionNum}>06</div>
            <div className={styles.sectionContent}>
              <h3 className={styles.sectionTitle}>Question Style</h3>
              <p className={styles.sectionDesc}>How each judge challenges you — give them a distinct pattern.</p>
              <ul className={styles.list}>
                <li>"Explain this simply" — clarity judge</li>
                <li>"What are the risks?" — skeptical judge</li>
                <li>"How would you implement this?" — execution judge</li>
                <li>"Why does this matter?" — impact judge</li>
              </ul>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionNum}>07</div>
            <div className={styles.sectionContent}>
              <h3 className={styles.sectionTitle}>Panel Dynamics</h3>
              <p className={styles.sectionDesc}>How they work together — makes it feel like a conversation, not separate interviews.</p>
              <ul className={styles.list}>
                <li>Some may interrupt; others wait their full turn</li>
                <li>One may build on another's question</li>
                <li>One may push back on what a colleague said</li>
              </ul>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionNum}>08</div>
            <div className={styles.sectionContent}>
              <h3 className={styles.sectionTitle}>Balance Check</h3>
              <p className={styles.sectionDesc}>Before finalising, make sure the panel covers all of these as a whole:</p>
              <div className={styles.checkGrid}>
                {[
                  'Different roles',
                  'Distinct personalities',
                  'Non-overlapping focus areas',
                  'Clear red flags per judge',
                  'Different question styles',
                ].map(item => (
                  <div key={item} className={styles.checkItem}>
                    <span className={styles.checkBox}>□</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className={styles.insight}>
            <span className={styles.insightQuote}>
              "A good panel is not about who they are — it's about how differently they think."
            </span>
          </div>

        </div>
      </div>
    </div>
  )
}
