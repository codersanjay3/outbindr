import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — Outbindr',
  description: 'Outbindr Privacy Policy',
}

const EFFECTIVE = 'April 8, 2026'

export default function PrivacyPage() {
  return (
    <div style={{
      minHeight: '100vh', background: '#fff',
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&display=swap" rel="stylesheet" />

      {/* Nav */}
      <div style={{
        borderBottom: '1px solid #e8e8e8', padding: '14px 32px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', color: '#000' }}>
            OUTBINDR
          </span>
        </Link>
        <span style={{ fontSize: 10, color: '#ccc', letterSpacing: '0.08em' }}>/ PRIVACY POLICY</span>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 32px 80px' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.1em', color: '#000', marginBottom: 6 }}>
          PRIVACY POLICY
        </h1>
        <p style={{ fontSize: 10, color: '#aaa', letterSpacing: '0.08em', marginBottom: 40 }}>
          Effective {EFFECTIVE}
        </p>

        <Section n="1" title="Who We Are">
          Outbindr ("we", "us", "our") operates the panel simulation platform at outbindr.com. This Privacy Policy explains what data we collect, how we use it, and your rights with respect to it.
        </Section>

        <Section n="2" title="Data We Collect">
          <strong>Account data:</strong> When you create an account, we collect your email address and a hashed version of your password (managed by Supabase Auth — we never see your raw password). We also collect your full name and age (provided at account registration).<br /><br />
          <strong>Session data:</strong> We store the content of your simulation sessions, including panel configurations you upload, pitch text you submit, AI-generated panel responses, scoring results, and conversation history. This is required to provide the resume and replay features.<br /><br />
          <strong>Usage data:</strong> We may collect standard server logs including IP addresses, browser type, and request timestamps for security and rate-limiting purposes.<br /><br />
          <strong>API keys:</strong> If you choose to save your Groq or ElevenLabs API keys to your account, they are stored encrypted in your Supabase user metadata. We do not use them for any purpose other than powering your simulations.
        </Section>

        <Section n="3" title="How We Use Your Data">
          We use your data solely to provide, maintain, and improve the Service:<br /><br />
          — Authenticate your account and maintain session state<br />
          — Store and retrieve your simulation history<br />
          — Power AI features by forwarding your content to third-party AI providers (see below)<br />
          — Detect and prevent abuse and enforce rate limits<br />
          — Send transactional emails (account confirmation, password reset)<br /><br />
          We do not use your data for advertising, analytics profiling, or to train AI models.
        </Section>

        <Section n="4" title="Third-Party AI Providers">
          To generate panel responses and transcribe audio, we send your content to the following third-party APIs:<br /><br />
          — <strong>Groq, Inc.</strong> — processes your pitch text and panel configuration to generate AI responses. Groq's privacy policy is available at groq.com.<br />
          — <strong>ElevenLabs, Inc.</strong> — converts AI-generated text to speech (optional; only if you have an ElevenLabs key configured). ElevenLabs' privacy policy is available at elevenlabs.io.<br /><br />
          We transmit only the content necessary to generate a response. We do not share your account information (email, name) with these providers.
        </Section>

        <Section n="5" title="Data Storage and Security">
          Your account and session data is stored in a Supabase-managed PostgreSQL database hosted on AWS infrastructure. Data is encrypted at rest and in transit. Access is controlled by Row Level Security policies ensuring you can only access your own sessions.<br /><br />
          We implement rate limiting and input validation to protect the Service against abuse. No system is perfectly secure — if you believe your account has been compromised, contact us immediately.
        </Section>

        <Section n="6" title="Data Retention">
          We retain your account and session data for as long as your account is active. You may request deletion of your account and all associated data at any time by emailing{' '}
          <a href="mailto:privacy@outbindr.com" style={{ color: '#000' }}>privacy@outbindr.com</a>.
          We will process deletion requests within 30 days.
        </Section>

        <Section n="7" title="Sharing and Disclosure">
          We do not sell, rent, or share your personal data with third parties for their own purposes. We may disclose data if required by law, court order, or to protect the rights and safety of Outbindr and its users. If you use the Replay Share feature, the session transcript becomes publicly accessible via a link — this is an explicit action you initiate.
        </Section>

        <Section n="8" title="Children">
          The Service is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe a child has created an account, contact us and we will remove the account.
        </Section>

        <Section n="9" title="Your Rights">
          Depending on your location, you may have rights to access, correct, delete, or export your personal data. You may also have the right to object to or restrict certain processing. To exercise these rights, email{' '}
          <a href="mailto:privacy@outbindr.com" style={{ color: '#000' }}>privacy@outbindr.com</a>.
          Users in the European Economic Area and United Kingdom have additional rights under GDPR and UK GDPR respectively.
        </Section>

        <Section n="10" title="Changes to This Policy">
          We may update this Privacy Policy from time to time. We will notify registered users of material changes via email. Continued use of the Service after changes take effect constitutes acceptance of the revised policy.
        </Section>

        <Section n="11" title="Contact">
          For privacy-related questions or data requests:{' '}
          <a href="mailto:privacy@outbindr.com" style={{ color: '#000' }}>privacy@outbindr.com</a>
        </Section>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #f0f0f0' }}>
          <Link href="/terms" style={{ fontSize: 10, color: '#888', letterSpacing: '0.08em', marginRight: 24 }}>
            Terms of Service →
          </Link>
          <Link href="/" style={{ fontSize: 10, color: '#888', letterSpacing: '0.08em' }}>
            ← Back to Outbindr
          </Link>
        </div>
      </div>
    </div>
  )
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 9, color: '#ccc', letterSpacing: '0.12em', flexShrink: 0 }}>{n}.</span>
        <h2 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#000', margin: 0, textTransform: 'uppercase' }}>
          {title}
        </h2>
      </div>
      <p style={{ fontSize: 12, color: '#444', lineHeight: 1.8, margin: 0, paddingLeft: 22 }}>
        {children}
      </p>
    </div>
  )
}
