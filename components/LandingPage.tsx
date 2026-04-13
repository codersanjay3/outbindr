'use client'
import { useEffect, useState } from 'react'
import AuthModal from './AuthModal'
import { ContainerScroll } from './ui/container-scroll-animation'
import { Carousel, CarouselContent, CarouselNavigation, CarouselIndicator, CarouselItem } from '@/components/ui/carousel'
import styles from './LandingPage.module.css'

interface Props {
  onEnterApp: () => void
}

const FEATURES = [
  { n: '01', title: 'Upload Any Panel', body: 'Drop a PDF or text file describing your evaluators. Names, roles, personalities, criteria — the AI handles the rest.' },
  { n: '02', title: 'Voice Your Pitch', body: 'Record your verbal pitch. Groq Whisper transcribes it in real time with live interim text.' },
  { n: '03', title: 'Live AI Panel', body: 'Each judge is a separate LLM call. They privately deliberate, then speak to you with distinct ElevenLabs voices.' },
  { n: '04', title: 'Agent Network', body: 'A live SVG graph shows judges connecting when one references another — backend coordination made visible.' },
  { n: '05', title: 'Round Responses', body: 'After every round, all judging questions surface together. You answer at once. Your response shapes the next round.' },
  { n: '06', title: 'Performance Report', body: '10 core criteria × 75 points + 2–4 case-specific criteria × 25 points. A real rubric. A real score out of 100.' },
]

/* ── App UI Preview inside the scroll container ── */
function AppPreview() {
  const panelists = [
    { name: 'ELENA VASQUEZ', role: 'Managing Partner · Andreessen', avatar: '🐺', color: '#c04040', bg: '#c0404015', bd: '#c04040' },
    { name: 'MARCUS REID', role: 'CTO · Former Google', avatar: '🦅', color: '#4060c0', bg: '#4060c015', bd: '#4060c0' },
    { name: 'PRIYA NAIR', role: 'Principal · Sequoia', avatar: '🦊', color: '#50a040', bg: '#50a04015', bd: '#50a040' },
  ]
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'IBM Plex Mono', monospace", background: '#fff', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderBottom: '1px solid #e8e8e8', background: '#fff', flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: '#000' }}>OUTBINDR</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i===1 ? '#000' : '#e0e0e0', border: '1px solid #ccc' }} />
          ))}
        </div>
        <span style={{ fontSize: 8, color: '#bbb', letterSpacing: '0.12em' }}>ROUND 2 / 3</span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left panel - agent graph */}
        <div style={{ width: 160, borderRight: '1px solid #e8e8e8', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 7, fontWeight: 600, letterSpacing: '0.18em', color: '#bbb', marginBottom: 4 }}>PANEL</div>
          {panelists.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', border: `1px solid ${i===1 ? p.bd : '#e8e8e8'}`, background: i===1 ? p.bg : 'transparent', borderRadius: 2 }}>
              <span style={{ fontSize: 14 }}>{p.avatar}</span>
              <div>
                <div style={{ fontSize: 7, fontWeight: 700, color: i===1 ? p.color : '#666', letterSpacing: '0.08em' }}>{p.name.split(' ')[0]}</div>
                <div style={{ fontSize: 6, color: '#bbb' }}>{i===1 ? '● speaking' : 'listening'}</div>
              </div>
            </div>
          ))}
          {/* mini network */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 7, fontWeight: 600, letterSpacing: '0.18em', color: '#bbb', marginBottom: 6 }}>NETWORK</div>
            <svg width="130" height="70" viewBox="0 0 130 70">
              <circle cx="20" cy="35" r="10" fill="#c0404015" stroke="#c04040" strokeWidth="1.5"/>
              <text x="20" y="39" textAnchor="middle" fontSize="9">🐺</text>
              <circle cx="65" cy="20" r="10" fill="#4060c025" stroke="#4060c0" strokeWidth="2"/>
              <text x="65" y="24" textAnchor="middle" fontSize="9">🦅</text>
              <circle cx="110" cy="35" r="10" fill="#50a04015" stroke="#50a040" strokeWidth="1.5"/>
              <text x="110" y="39" textAnchor="middle" fontSize="9">🦊</text>
              <line x1="30" y1="35" x2="55" y2="22" stroke="#c8962a" strokeWidth="1.5" opacity="0.8"/>
              <line x1="75" y1="22" x2="100" y2="33" stroke="#c8962a" strokeWidth="1" opacity="0.4"/>
            </svg>
          </div>
        </div>

        {/* Main panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Active speaker */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#4060c015', border: '1.5px solid #4060c0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🦅</div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#4060c0', letterSpacing: '0.12em' }}>MARCUS REID</div>
                <div style={{ fontSize: 8, color: '#888' }}>CTO · Former Google</div>
              </div>
              <div style={{ marginLeft: 'auto', fontSize: 7, color: '#0a0', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#0a0', display: 'inline-block' }}/>speaking
              </div>
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.6, color: '#222' }}>
              The technical architecture you described is ambitious. Given your current team size, what's your <strong>rollout plan</strong> for the first six months, and how are you thinking about{' '}
              <span style={{ borderBottom: '1px solid #000', paddingBottom: 1 }}>infrastructure costs</span> at scale?
            </div>
          </div>

          {/* Prev messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { avatar: '🐺', name: 'ELENA', color: '#c04040', text: "Walk us through your go-to-market strategy. Who's your first paying customer?" },
              { avatar: '🦊', name: 'PRIYA', color: '#50a040', text: 'The unit economics feel optimistic. What does payback period look like at 100 customers?' },
            ].map((m, i) => (
              <div key={i} style={{ fontSize: 10, color: '#555', lineHeight: 1.55, padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                <span style={{ fontWeight: 700, color: m.color, fontSize: 8, letterSpacing: '0.1em' }}>{m.avatar} {m.name} · </span>
                {m.text}
              </div>
            ))}
            {/* User reply */}
            <div style={{ fontSize: 10, color: '#000', lineHeight: 1.55, padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
              <span style={{ fontWeight: 700, color: '#000', fontSize: 8, letterSpacing: '0.1em' }}>YOU · </span>
              Our first customer is already in pilot — a Series B SaaS company. Month 6 target is 12 enterprise contracts at $4k ARR each...
            </div>
          </div>

          {/* Input bar */}
          <div style={{ padding: '10px 18px', borderTop: '1px solid #e8e8e8', background: '#fafafa', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, border: '1px solid #000', padding: '8px 12px', fontSize: 10, color: '#bbb', background: '#fff', letterSpacing: '0.04em' }}>
                Your response to all panelists...
              </div>
              <button style={{ background: '#000', color: '#fff', border: 'none', padding: '8px 14px', fontSize: 9, fontFamily: 'inherit', fontWeight: 600, letterSpacing: '0.12em', cursor: 'pointer' }}>
                SEND →
              </button>
            </div>
            <div style={{ fontSize: 7, color: '#bbb', marginTop: 4, letterSpacing: '0.08em' }}>⌘↵ to submit · Round 2 of 3 complete after this</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage({ onEnterApp }: Props) {
  const [showAuth, setShowAuth] = useState(false)

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
        <div className={styles.navLogo}>
          <img src="/logo.png" alt="Outbindr" className={styles.navLogoImg} />
          OUTBINDR
        </div>
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
            Simulate a live judging panel with AI evaluators who ask sharp questions,
            debate each other, and score your performance against a 100-point rubric.
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

      {/* ── ContainerScroll demo ── */}
      <div id="demo" style={{ background: '#fafafa', borderBottom: '1px solid #e8e8e8' }}>
        <ContainerScroll>
          <AppPreview />
        </ContainerScroll>
      </div>

      {/* ── Features ── */}
      <section id="features" className={styles.features}>
        <div className={styles.featuresInner}>
          <div className={styles.sectionEye}>WHAT YOU GET</div>
          <h2 className={styles.sectionTitle}>Everything a real evaluation room has.</h2>
          <div style={{ position: 'relative', marginTop: 32, paddingBottom: 56 }}>
            <Carousel>
              <CarouselContent>
                {FEATURES.map((f, i) => (
                  <CarouselItem key={i}>
                    <div style={{
                      padding: '48px 40px',
                      border: '1px solid #e8e8e8',
                      minHeight: 240,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                      fontFamily: "'IBM Plex Mono', monospace",
                      userSelect: 'none' as const,
                      background: '#fff',
                    }}>
                      <div style={{ fontSize: 10, color: '#bbb', letterSpacing: '0.2em', fontWeight: 700 }}>{f.n}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#000', letterSpacing: '-0.01em', lineHeight: 1.2 }}>{f.title}</div>
                      <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7, maxWidth: 580 }}>{f.body}</div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselNavigation
                className='absolute -bottom-2 left-auto top-auto w-full justify-end gap-2'
                classNameButton='bg-black *:stroke-white disabled:opacity-30'
                alwaysShow
              />
              <CarouselIndicator
                className='relative mt-4 bottom-auto'
                classNameButton='bg-black'
              />
            </Carousel>
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
              { n:'02', t:'Pitch', b:'Record your verbal pitch or type your idea. Whisper AI transcribes it. Your words become the foundation of the session.' },
              { n:'03', t:'Panel + Respond', b:'AI judges deliberate privately, speak publicly. After each round, answer all their questions at once. Your answers shape the next round.' },
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
            The judges aren&apos;t real.<br/>Your preparation should be.
          </h2>
          <button className={styles.finalBtn} onClick={() => setShowAuth(true)}>
            Launch Free Session →
          </button>
          <p className={styles.finalNote}>No credit card. 3 sessions included. Real rubric.</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <span className={styles.footerLogo}>
          <img src="/logo.png" alt="Outbindr" className={styles.footerLogoImg} />
          OUTBINDR
        </span>
        <span className={styles.footerNote}>Panel Simulator · AI-Powered · Built with Claude</span>
      </footer>
    </div>
  )
}
