'use client'
import { useEffect, useRef, useState } from 'react'
import AuthModal from './AuthModal'
import styles from './LandingPage.module.css'

interface Props {
  onEnterApp: () => void
}

const FEATURES = [
  { n: '01', title: 'Upload Any Panel', body: 'Drop a PDF or text file describing your evaluators. Names, roles, personalities, criteria — the AI handles the rest.' },
  { n: '02', title: 'Voice Your Pitch', body: 'Record your verbal pitch. Groq Whisper transcribes it in real time with live interim text.' },
  { n: '03', title: 'Live AI Panel', body: 'Each investor is a separate LLM call. They privately deliberate, then speak to you with distinct ElevenLabs voices.' },
  { n: '04', title: 'Agent Network', body: 'A live SVG graph shows investors connecting when one references another — backend coordination made visible.' },
  { n: '05', title: 'Round Responses', body: 'After every round, all investor questions surface together. You answer at once. Your response shapes the next round.' },
  { n: '06', title: 'Performance Report', body: '10 core criteria × 75 points + 2–4 case-specific criteria × 25 points. A real rubric. A real score out of 100.' },
]

/* ── Mini MacBook scene components ── */
function SceneSetup() {
  return (
    <div className={styles.sceneWrap}>
      <div className={styles.sceneTopBar}>
        <span className={styles.sceneWordmark}>PITCHWARS</span>
        <span className={styles.sceneKeysBtn}>KEYS</span>
      </div>
      <div className={styles.sceneInner}>
        <div className={styles.sceneSection}>
          <span className={styles.sceneNum}>01</span>
          <div className={styles.sceneSectionBody}>
            <div className={styles.sceneLabel}>CONFIGURE YOUR PANEL</div>
            <div className={styles.sceneDropzone}>
              <div className={styles.sceneDropArrow} />
              <span>DROP PANEL DOCUMENT</span>
              <span className={styles.sceneDropSub}>PDF · TXT · MD</span>
            </div>
          </div>
        </div>
        <div className={styles.sceneSection}>
          <span className={styles.sceneNum}>02</span>
          <div className={styles.sceneSectionBody}>
            <div className={styles.sceneLabel}>YOUR PITCH</div>
            <div className={styles.sceneRecordBtn}>
              <div className={styles.sceneRecordDot} />
            </div>
            <div className={styles.sceneRecordLabel}>TAP TO RECORD</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ScenePanel() {
  return (
    <div className={styles.sceneWrap}>
      <div className={styles.sceneTopBar}>
        <span className={styles.sceneWordmark}>Panel Session</span>
        <div className={styles.scenePips}>
          {[0,1,2].map(i => <span key={i} className={`${styles.scenePip} ${i===1?styles.scenePipOn:''}`} />)}
        </div>
      </div>
      {/* Network graph dots */}
      <div className={styles.sceneGraph}>
        {['#c04040','#4060c0','#50a040'].map((c,i) => (
          <div key={i} className={styles.sceneGraphNode} style={{ background: c+'22', borderColor: c, opacity: i===1?1:0.5 }}>
            {['🐺','🦅','🦊'][i]}
          </div>
        ))}
        <svg className={styles.sceneGraphSvg} viewBox="0 0 120 60">
          <line x1="20" y1="30" x2="60" y2="30" stroke="#c8962a" strokeWidth="1" opacity="0.6"/>
          <line x1="60" y1="30" x2="100" y2="30" stroke="#c8962a" strokeWidth="1" opacity="0.3"/>
        </svg>
      </div>
      {/* Active speaker */}
      <div className={styles.sceneSpeaker}>
        <div className={styles.sceneSpeakerHeader}>
          <div className={styles.sceneSpeakerAvatar} style={{ background:'#4060c022', borderColor:'#4060c0' }}>🦅</div>
          <div>
            <div className={styles.sceneSpeakerName} style={{ color:'#4060c0' }}>MARCUS REID</div>
            <div className={styles.sceneSpeakerRole}>CTO · Former Google</div>
          </div>
          <span className={styles.sceneSpeakingBadge}>● speaking</span>
        </div>
        <div className={styles.sceneSpeakerText}>
          The technical architecture you described raises an important question.
          What's your plan for&nbsp;<span className={styles.sceneCursor}/>
        </div>
      </div>
      {/* Subtitle */}
      <div className={styles.sceneSubtitle}>
        🎙 "The technical architecture you described..."
      </div>
    </div>
  )
}

function SceneReport() {
  const bars = [
    { label:'Communication', w:'82%' },
    { label:'Critical Thinking', w:'74%' },
    { label:'Subject Mastery', w:'88%' },
    { label:'Confidence', w:'70%' },
    { label:'Adaptability', w:'78%' },
  ]
  return (
    <div className={styles.sceneWrap}>
      <div className={styles.sceneTopBar}>
        <span className={styles.sceneWordmark}>Universal Panel Evaluation</span>
      </div>
      <div className={styles.sceneReport}>
        <div className={styles.sceneReportHero}>
          <div className={styles.sceneScore}>78</div>
          <div>
            <div className={styles.sceneScoreOf}>/100</div>
            <div className={styles.sceneScoreTier}>Strong</div>
          </div>
        </div>
        <div className={styles.sceneBarList}>
          {bars.map((b,i) => (
            <div key={i} className={styles.sceneBarRow}>
              <span className={styles.sceneBarLabel}>{b.label}</span>
              <div className={styles.sceneBarBg}>
                <div className={styles.sceneBarFill} style={{ width: b.w }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const SCENES = [SceneSetup, ScenePanel, SceneReport]
const SCENE_LABELS = ['01 · SETUP', '02 · PANEL', '03 · REPORT']

export default function LandingPage({ onEnterApp }: Props) {
  const [showAuth, setShowAuth]       = useState(false)
  const [scrollPct, setScrollPct]     = useState(0)
  const [visibleFeats, setVisibleFeat] = useState<boolean[]>(Array(FEATURES.length).fill(false))
  const stickyRef    = useRef<HTMLDivElement>(null)
  const featureRefs  = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const onScroll = () => {
      // MacBook scroll progress
      if (stickyRef.current) {
        const rect = stickyRef.current.getBoundingClientRect()
        const total = stickyRef.current.offsetHeight - window.innerHeight
        const pct = Math.max(0, Math.min(1, -rect.top / total))
        setScrollPct(pct)
      }
      // Feature reveal
      featureRefs.current.forEach((el, i) => {
        if (el) {
          const r = el.getBoundingClientRect()
          if (r.top < window.innerHeight * 0.88) {
            setVisibleFeat(prev => { const n = [...prev]; n[i] = true; return n })
          }
        }
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scene = scrollPct < 0.33 ? 0 : scrollPct < 0.66 ? 1 : 2
  const SceneComponent = SCENES[scene]

  return (
    <div className={styles.wrap}>
      {showAuth && (
        <AuthModal
          onSuccess={() => { setShowAuth(false); onEnterApp() }}
          onClose={() => setShowAuth(false)}
        />
      )}

      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>PITCHWARS</div>
        <div className={styles.navRight}>
          <a href="#features" className={styles.navLink}>Features</a>
          <a href="#how" className={styles.navLink}>How It Works</a>
          <button className={styles.navCta} onClick={() => setShowAuth(true)}>
            Sign In
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroEyebrow}>PANEL SIMULATOR · AI-POWERED · REAL RESULTS</div>
          <h1 className={styles.heroTitle}>
            Pitch against AI.<br/>Walk in ready.
          </h1>
          <p className={styles.heroSub}>
            Simulate a live investor panel with AI evaluators who ask sharp questions,
            debate each other behind the scenes, and score your performance against
            a universal 100-point rubric.
          </p>
          <div className={styles.heroCtas}>
            <button className={styles.ctaPrimary} onClick={() => setShowAuth(true)}>
              Launch Free Session →
            </button>
            <a href="#demo" className={styles.ctaSecondary}>
              See How It Works ↓
            </a>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.stat}><strong>10</strong> core criteria</div>
            <div className={styles.statDot}>·</div>
            <div className={styles.stat}><strong>3</strong> rounds</div>
            <div className={styles.statDot}>·</div>
            <div className={styles.stat}><strong>100</strong> point rubric</div>
          </div>
        </div>
      </section>

      {/* ── MacBook demo (sticky scroll) ── */}
      <div id="demo" className={styles.demoOuter} ref={stickyRef}>
        <div className={styles.demoSticky}>
          <div className={styles.demoLabel}>
            {SCENE_LABELS.map((l, i) => (
              <span key={i} className={`${styles.demoLabelItem} ${scene === i ? styles.demoLabelOn : ''}`}>
                {l}
              </span>
            ))}
          </div>
          {/* MacBook */}
          <div className={styles.macbook}>
            {/* Lid */}
            <div className={styles.macbookLid}>
              <div className={styles.macbookCamera} />
              <div className={styles.macbookScreen}>
                <SceneComponent />
              </div>
            </div>
            {/* Base */}
            <div className={styles.macbookBase}>
              <div className={styles.macbookKeyboard}>
                {Array.from({length:48}).map((_,i) => <div key={i} className={styles.macbookKey}/>)}
              </div>
              <div className={styles.macbookTrackpad} />
            </div>
            <div className={styles.macbookFoot} />
          </div>
          {/* Scroll hint on first scene */}
          {scrollPct < 0.05 && (
            <div className={styles.scrollHint}>
              <div className={styles.scrollArrow} />
              <span>Scroll to explore</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Features ── */}
      <section id="features" className={styles.features}>
        <div className={styles.featuresInner}>
          <div className={styles.sectionEye}>WHAT YOU GET</div>
          <h2 className={styles.sectionTitle}>Everything a real evaluation room has.</h2>
          <div className={styles.featureGrid}>
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className={`${styles.featureCard} ${visibleFeats[i] ? styles.featureCardVisible : ''}`}
                ref={el => { featureRefs.current[i] = el }}
                style={{ transitionDelay: `${(i % 3) * 80}ms` }}
              >
                <div className={styles.featureNum}>{f.n}</div>
                <div className={styles.featureTitle}>{f.title}</div>
                <div className={styles.featureBody}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className={styles.how}>
        <div className={styles.howInner}>
          <div className={styles.sectionEye}>THE PROCESS</div>
          <h2 className={styles.sectionTitle}>Four steps from pitch to report.</h2>
          <div className={styles.steps}>
            {[
              { n:'01', t:'Configure', b:'Upload a document defining your panel — names, roles, personalities, criteria. The AI parses it into individual evaluators.' },
              { n:'02', t:'Pitch', b:'Record your verbal pitch or upload a deck. Whisper AI transcribes it. Your words become the foundation of the session.' },
              { n:'03', t:'Panel + Respond', b:'AI investors deliberate privately, speak publicly. After each round, answer all their questions at once. Your answers shape the next round.' },
              { n:'04', t:'Receive Report', b:'A 100-point Universal Performance Report: 10 core criteria, 2–4 context-specific criteria chosen by the panel, and a final recommendation tier.' },
            ].map((s, i) => (
              <div key={i} className={styles.step}>
                <div className={styles.stepNum}>{s.n}</div>
                {i < 3 && <div className={styles.stepLine} />}
                <div className={styles.stepTitle}>{s.t}</div>
                <div className={styles.stepBody}>{s.b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className={styles.finalCta}>
        <div className={styles.finalCtaInner}>
          <div className={styles.finalEye}>READY?</div>
          <h2 className={styles.finalTitle}>
            The investors aren&apos;t real.<br/>Your preparation should be.
          </h2>
          <button className={styles.finalBtn} onClick={() => setShowAuth(true)}>
            Launch Free Session →
          </button>
          <p className={styles.finalNote}>No credit card. 3 sessions included. Real rubric.</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <span className={styles.footerLogo}>PITCHWARS</span>
        <span className={styles.footerNote}>Panel Simulator · AI-Powered · Built with Claude</span>
      </footer>
    </div>
  )
}
