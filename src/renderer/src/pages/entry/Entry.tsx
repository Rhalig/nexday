import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../../assets/logo.jpg'
import googleIcon from '../../assets/google.svg'
import previewToday from '../../assets/preview-today.png'
import previewRegister from '../../assets/preview-register.png'
import { useAuth } from '../../store/auth'
import './entry.css'

export const Brand = (): React.JSX.Element => (
  <div className="nx-brand">
    <i style={{ backgroundImage: `url(${logo})` }} />
    <span>Nexday</span>
  </div>
)

function Split({
  children,
  preview,
  title,
  sub
}: {
  children: ReactNode
  preview: string
  title: string
  sub: string
}): React.JSX.Element {
  return (
    <>
      <div className="drag-strip" />
      <div className="nx-en">
        <div className="nx-panel">
          <div className="nx-form">
            <Brand />
            <div className="nx-box">{children}</div>
            <div className="nx-foot">
              <span>© 2026 Nexday</span>
              <span>Privacy</span>
              <span>Terms</span>
            </div>
          </div>
          <div className="nx-prev">
            <div className="t">
              <b>{title}</b>
              <span>{sub}</span>
            </div>
            <img src={preview} alt="" />
          </div>
        </div>
      </div>
    </>
  )
}

const Divider = ({ my }: { my: number }): React.JSX.Element => (
  <div className="nx-or" style={{ margin: `${my}px 0` }}>
    <i />
    <span>or with email</span>
    <i />
  </div>
)

const Eye = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#767676"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

function Social({ verb, onDone }: { verb: string; onDone: () => void }): React.JSX.Element {
  return (
    <div className="col" style={{ gap: 10 }}>
      <button className="nx-btn" onClick={onDone}>
        <img src={googleIcon} width={16} height={16} alt="" />
        <span>{verb} with Google</span>
      </button>
    </div>
  )
}

function Password({
  placeholder,
  value,
  onChange,
  err
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
  err?: boolean
}): React.JSX.Element {
  const [show, setShow] = useState(false)
  return (
    <label className={err ? 'nx-field err' : 'nx-field'}>
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span style={{ display: 'flex', cursor: 'pointer' }} onClick={() => setShow(!show)}>
        {Eye}
      </span>
    </label>
  )
}

/* ---------------- Launch ---------------- */

export function Launch(): React.JSX.Element {
  const navigate = useNavigate()
  const signedIn = useAuth((s) => s.signedIn)
  useEffect(() => {
    const t = setTimeout(() => navigate(signedIn ? '/today' : '/register', { replace: true }), 4000)
    return () => clearTimeout(t)
  }, [navigate, signedIn])
  return (
    <>
      <div className="drag-strip" />
      <div className="nx-en">
        <div className="nx-panel">
          <div className="nx-launch">
            <i style={{ backgroundImage: `url(${logo})` }} />
          </div>
        </div>
      </div>
    </>
  )
}

/* ---------------- Log in ---------------- */

const WRONG = 'That email and password don’t match. Try again or reset your password.'

export function Login(): React.JSX.Element {
  const navigate = useNavigate()
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 1) {
      setError(WRONG)
      return
    }
    if (!auth.configured) {
      // No Supabase set up (development): a valid email and an 8+ character password get you in.
      if (password.length >= 8) {
        auth.signIn({ email })
        navigate('/today')
      } else setError(WRONG)
      return
    }
    setBusy(true)
    const r = await auth.signInWithPassword(email.trim(), password)
    setBusy(false)
    if (r.error) setError(r.error)
    else navigate('/today')
  }
  const social = async (): Promise<void> => {
    setError(null)
    if (!auth.configured) {
      auth.signIn({})
      navigate('/today')
      return
    }
    const r = await auth.signInWithGoogle()
    if (r.error) setError(r.error)
  }

  return (
    <Split
      preview={previewToday}
      title="Plan the day you actually have."
      sub="Nexday reads your calendar, tasks and notes, then fits the work into the gaps you really have."
    >
      <h1>Welcome back</h1>
      <p className="nx-sub">Log in to see what today looks like.</p>
      <div style={{ marginTop: 28 }}>
        <Social verb="Continue" onDone={() => void social()} />
      </div>
      <Divider my={22} />
      <form
        className="col"
        style={{ gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="col" style={{ gap: 6 }}>
          <span className="nx-lbl">Email</span>
          <label className="nx-field">
            <input
              type="email"
              placeholder="you@studio.co"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="nx-lbl">Password</span>
            <a style={{ fontSize: 12.5, color: 'var(--ink2)' }} onClick={() => navigate('/forgot')}>
              Forgot password?
            </a>
          </div>
          <Password
            placeholder="Your password"
            value={password}
            onChange={setPassword}
            err={!!error}
          />
          {error && (
            <div className="row" style={{ gap: 6, marginTop: 2, alignItems: 'flex-start' }}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#C2362B"
                strokeWidth="2"
                strokeLinecap="round"
                style={{ marginTop: 2, flexShrink: 0 }}
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5M12 16v.01" />
              </svg>
              <span style={{ fontSize: 12.5, color: 'var(--err)', lineHeight: 1.5 }}>{error}</span>
            </div>
          )}
        </div>
        <button type="submit" className="nx-btn dark" style={{ marginTop: 4 }} disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p style={{ fontSize: 13.5, color: 'var(--ink2)', marginTop: 24, textAlign: 'center' }}>
        New to Nexday?{' '}
        <a style={{ fontWeight: 500 }} onClick={() => navigate('/register')}>
          Create an account
        </a>
      </p>
    </Split>
  )
}

/* ---------------- Register ---------------- */

export function Register(): React.JSX.Element {
  const navigate = useNavigate()
  const auth = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const create = async (): Promise<void> => {
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.')
    if (password.length < 8) return setError('Use at least 8 characters for the password.')
    if (!auth.configured) {
      auth.signIn({ name: name.trim(), email: email.trim() })
      navigate('/onboarding/1')
      return
    }
    setBusy(true)
    const r = await auth.signUp(name.trim(), email.trim(), password)
    setBusy(false)
    if (r.error) setError(r.error)
    else if (r.needsConfirm)
      navigate('/forgot/sent', { state: { email: email.trim(), kind: 'confirm' } })
    else navigate('/onboarding/1')
  }
  const social = async (): Promise<void> => {
    setError(null)
    if (!auth.configured) {
      auth.signIn({})
      navigate('/onboarding/1')
      return
    }
    const r = await auth.signInWithGoogle()
    if (r.error) setError(r.error)
  }
  return (
    <Split
      preview={previewRegister}
      title="Everything that needs your time, in one plan."
      sub="Meetings, tasks, notes and habits sit side by side, so nothing gets double-booked."
    >
      <h1>Create your account</h1>
      <p className="nx-sub">Free for 14 days. No card needed.</p>
      <div style={{ marginTop: 24 }}>
        <Social verb="Sign up" onDone={() => void social()} />
      </div>
      <Divider my={20} />
      <form
        className="col"
        style={{ gap: 14 }}
        onSubmit={(e) => {
          e.preventDefault()
          void create()
        }}
      >
        <div className="col" style={{ gap: 6 }}>
          <span className="nx-lbl">Name</span>
          <label className="nx-field">
            <input
              type="text"
              placeholder="Umut"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <span className="nx-lbl">Email</span>
          <label className="nx-field">
            <input
              type="email"
              placeholder="you@studio.co"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <span className="nx-lbl">Password</span>
          <Password
            placeholder="At least 8 characters"
            value={password}
            onChange={setPassword}
            err={!!error && /password/i.test(error)}
          />
          {error && (
            <span style={{ fontSize: 12.5, color: 'var(--err)', lineHeight: 1.5, marginTop: 2 }}>
              {error}
            </span>
          )}
        </div>
        <button type="submit" className="nx-btn dark" style={{ marginTop: 4 }} disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p
        style={{
          fontSize: 12.5,
          color: 'var(--ink3)',
          marginTop: 14,
          textAlign: 'center',
          lineHeight: 1.5
        }}
      >
        By creating an account you agree to the{' '}
        <a style={{ color: 'var(--ink2)', textDecoration: 'underline' }}>Terms</a> and{' '}
        <a style={{ color: 'var(--ink2)', textDecoration: 'underline' }}>Privacy Policy</a>.
      </p>
      <p style={{ fontSize: 13.5, color: 'var(--ink2)', marginTop: 20, textAlign: 'center' }}>
        Already have an account?{' '}
        <a style={{ fontWeight: 500 }} onClick={() => navigate('/login')}>
          Log in
        </a>
      </p>
    </Split>
  )
}

/* ---------------- Forgot / check email ---------------- */

const BackLink = ({ onClick, mt }: { onClick: () => void; mt?: number }): React.JSX.Element => (
  <a
    className="row"
    style={{
      gap: 6,
      marginTop: mt,
      justifyContent: 'center',
      fontSize: 13.5,
      color: 'var(--ink2)'
    }}
    onClick={onClick}
  >
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
    <span>Back to log in</span>
  </a>
)

export function Forgot(): React.JSX.Element {
  const navigate = useNavigate()
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const send = async (): Promise<void> => {
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.')
    if (auth.configured) {
      setBusy(true)
      const r = await auth.resetPassword(email.trim())
      setBusy(false)
      if (r.error) return setError(r.error)
    }
    navigate('/forgot/sent', { state: { email: email.trim(), kind: 'reset' } })
  }
  return (
    <Split
      preview={previewToday}
      title="Plan the day you actually have."
      sub="Nexday reads your calendar, tasks and notes, then fits the work into the gaps you really have."
    >
      <h1>Reset your password</h1>
      <p className="nx-sub">
        Enter the email you signed up with and we&apos;ll send you a link to choose a new password.
      </p>
      <form
        className="col"
        style={{ gap: 16, marginTop: 28 }}
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <div className="col" style={{ gap: 6 }}>
          <span className="nx-lbl">Email</span>
          <label className="nx-field">
            <input
              type="email"
              placeholder="you@studio.co"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        </div>
        {error && (
          <span style={{ fontSize: 12.5, color: 'var(--err)', lineHeight: 1.5 }}>{error}</span>
        )}
        <button type="submit" className="nx-btn dark" style={{ marginTop: 4 }} disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <BackLink mt={24} onClick={() => navigate('/login')} />
    </Split>
  )
}

/* ---------------- Set a new password (after a reset link) ---------------- */

export function ResetPassword(): React.JSX.Element {
  const navigate = useNavigate()
  const auth = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async (): Promise<void> => {
    setError(null)
    if (password.length < 8) return setError('Use at least 8 characters for the password.')
    if (password !== confirm) return setError('The two passwords do not match.')
    if (!auth.configured) {
      navigate('/login')
      return
    }
    setBusy(true)
    const r = await auth.updatePassword(password)
    setBusy(false)
    if (r.error) return setError(r.error)
    navigate('/today', { replace: true })
  }

  const expired = auth.configured && !auth.signedIn && !auth.recovery

  return (
    <Split
      preview={previewRegister}
      title="A fresh start."
      sub="Set a new password and Nexday picks up exactly where you left off."
    >
      {expired ? (
        <>
          <h1>This link has expired</h1>
          <p className="nx-sub">
            Reset links work once and last 30 minutes. Request a new one to continue.
          </p>
          <button
            className="nx-btn dark"
            style={{ marginTop: 28 }}
            onClick={() => navigate('/forgot')}
          >
            Send a new link
          </button>
          <BackLink mt={24} onClick={() => navigate('/login')} />
        </>
      ) : (
        <>
          <h1>Set a new password</h1>
          <p className="nx-sub">
            You&apos;re signed in from the reset link{auth.email ? ` as ${auth.email}` : ''}. Choose
            a new password for your account.
          </p>
          <form
            className="col"
            style={{ gap: 16, marginTop: 28 }}
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            <div className="col" style={{ gap: 6 }}>
              <span className="nx-lbl">New password</span>
              <Password
                placeholder="At least 8 characters"
                value={password}
                onChange={setPassword}
                err={!!error && /password/i.test(error)}
              />
            </div>
            <div className="col" style={{ gap: 6 }}>
              <span className="nx-lbl">Repeat password</span>
              <Password
                placeholder="Type it again"
                value={confirm}
                onChange={setConfirm}
                err={!!error && /match/i.test(error)}
              />
            </div>
            {error && (
              <div className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#C2362B"
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{ marginTop: 2, flexShrink: 0 }}
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7.5v5M12 16v.01" />
                </svg>
                <span style={{ fontSize: 12.5, color: 'var(--err)', lineHeight: 1.5 }}>
                  {error}
                </span>
              </div>
            )}
            <button type="submit" className="nx-btn dark" style={{ marginTop: 4 }} disabled={busy}>
              {busy ? 'Saving…' : 'Save new password'}
            </button>
          </form>
          <a
            className="row"
            style={{
              gap: 6,
              marginTop: 22,
              justifyContent: 'center',
              fontSize: 13.5,
              color: 'var(--ink2)'
            }}
            onClick={() => {
              void auth.signOut()
              navigate('/login')
            }}
          >
            <span>Cancel and log out</span>
          </a>
        </>
      )}
    </Split>
  )
}

export function CheckEmail({
  email,
  kind = 'reset'
}: {
  email: string
  kind?: 'reset' | 'confirm'
}): React.JSX.Element {
  const navigate = useNavigate()
  const auth = useAuth()
  const [left, setLeft] = useState(42)
  const resend = async (): Promise<void> => {
    if (kind === 'reset' && auth.configured) await auth.resetPassword(email)
    setLeft(42)
  }
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(s - 1, 0)), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <Split
      preview={previewToday}
      title="Plan the day you actually have."
      sub="Nexday reads your calendar, tasks and notes, then fits the work into the gaps you really have."
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#F38020"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="M3.5 7.5l8.5 6 8.5-6" />
      </svg>
      <h1 style={{ marginTop: 16 }}>Check your email</h1>
      <p className="nx-sub">
        We sent {kind === 'confirm' ? 'a confirmation link' : 'a reset link'} to{' '}
        <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{email}</span>.{' '}
        {kind === 'confirm'
          ? 'Open it to finish creating your account.'
          : 'It expires in 30 minutes.'}
      </p>
      <div className="col" style={{ gap: 10, marginTop: 28 }}>
        <button className="nx-btn dark" onClick={() => navigate('/login')}>
          Open email app
        </button>
      </div>
      <div className="col" style={{ gap: 10, marginTop: 24, alignItems: 'center' }}>
        <p style={{ fontSize: 13.5, color: 'var(--ink2)' }}>
          Didn&apos;t get it?{' '}
          {left > 0 ? (
            <span style={{ color: 'var(--ink3)' }}>
              Resend in 0:{String(left).padStart(2, '0')}
            </span>
          ) : (
            <a style={{ fontWeight: 500 }} onClick={() => void resend()}>
              Resend
            </a>
          )}
        </p>
        <BackLink onClick={() => navigate('/login')} />
      </div>
    </Split>
  )
}
