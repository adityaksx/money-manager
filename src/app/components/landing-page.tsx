"use client";

import Brand from "@/app/components/brand";
import { ArrowDownRight, ArrowLeftRight, ArrowRight, ArrowUpRight, BadgeCheck, Banknote, CalendarClock, ChartNoAxesCombined, Check, ChevronRight, CircleHelp, Landmark, LockKeyhole, PieChart, ShieldCheck, Sparkles, Target, Wallet } from "lucide-react";

type LandingPageProps = {
  configured: boolean;
  busy: boolean;
  error: string;
  onSignIn: () => void;
};

const features = [
  { icon: ArrowLeftRight, tint: "mint", title: "Every transaction, accounted for", text: "Record income, expenses, refunds and transfers without double-counting money between your own accounts." },
  { icon: ChartNoAxesCombined, tint: "blue", title: "Monthly clarity", text: "Compare months, see net cash flow, and understand what is coming in and going out." },
  { icon: Target, tint: "gold", title: "Budgets that make sense", text: "Set category limits and see how much of your monthly plan is already used." },
  { icon: Landmark, tint: "purple", title: "Accounts in one view", text: "Keep bank, cash and wallet balances together with a dated activity trail." },
  { icon: PieChart, tint: "blue", title: "Investments, not scattered notes", text: "Track stocks, mutual funds, ETFs, gold and manually priced assets in one portfolio." },
  { icon: CalendarClock, tint: "mint", title: "Fixed-deposit tracking", text: "Save the principal, rate, compounding frequency and maturity date to estimate accrued interest and maturity value." },
];

const faqs = [
  { question: "Does RupeeTrail connect to my bank account?", answer: "No. You record transactions and balances yourself. RupeeTrail does not ask for online banking credentials or import bank activity automatically." },
  { question: "Can I see spending month by month?", answer: "Yes. The Transactions page has a month selector and an All months view. The income, net expense, net cash-flow and transaction-count cards respond to the selected view and active filters." },
  { question: "Can I track fixed deposits?", answer: "Yes. Add an FD in Investments with its principal, opening date, maturity date, annual interest rate and compounding frequency. RupeeTrail estimates the value and interest; actual proceeds may differ due to taxes, payout options and bank rules." },
  { question: "Is my data public?", answer: "Your financial records are stored under your signed-in account and protected by database row-level security. Use your own trusted devices and keep your Google account secure." },
];

export default function LandingPage({ configured, busy, error, onSignIn }: LandingPageProps) {
  return (
    <div className="landing-shell" id="top">
      <header className="landing-nav">
        <a href="#top" className="landing-brand" aria-label="RupeeTrail home"><Brand size="large" /></a>
        <nav className="landing-links" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#privacy">Privacy</a>
        </nav>
        <button className="btn landing-signin" type="button" onClick={onSignIn} disabled={!configured || busy}>
          {busy ? "Connecting…" : "Sign in"} <ChevronRight size={15} />
        </button>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-copy">
            <div className="landing-eyebrow"><span className="landing-eyebrow-dot" /> PERSONAL FINANCE, WITH A CLEARER VIEW</div>
            <h1>Every rupee has a <span>trail.</span></h1>
            <p className="landing-lede">A calmer way to understand your money. Track spending, plan budgets, monitor investments and know what is coming next — all in one private workspace.</p>
            <div className="landing-actions">
              <button className="btn primary landing-primary" type="button" onClick={onSignIn} disabled={!configured || busy}>
                {busy ? "Connecting to Google…" : "Start tracking"} <ArrowRight size={17} />
              </button>
              <a className="landing-secondary" href="#features">Explore the features <ArrowDownRight size={16} /></a>
            </div>
            {error && <div className="auth-error landing-error">{error}</div>}
            {!configured && <div className="setup-card landing-error">Sign-in is not configured for this deployment. Add the Supabase public URL and key to enable account access.</div>}
            <div className="landing-reassurance"><span><ShieldCheck size={16} /> Private by account</span><span><LockKeyhole size={15} /> No bank credentials</span></div>
          </div>

          <div className="landing-preview-wrap" aria-label="Illustrative dashboard preview">
            <div className="landing-orbit landing-orbit-one" />
            <div className="landing-orbit landing-orbit-two" />
            <div className="landing-preview">
              <div className="preview-topbar">
                <div className="preview-brand"><span className="preview-mark">₹</span><span>RupeeTrail</span></div>
                <span className="preview-private"><span /> Your overview</span>
              </div>
              <div className="preview-greeting"><div><span>PERSONAL OVERVIEW</span><h2>Your money, at a glance.</h2></div><span className="preview-date">THIS MONTH</span></div>
              <div className="preview-metrics">
                <div className="preview-metric"><span>Total balance</span><strong>₹84,250</strong><small><Wallet size={13} /> Accounts + investments</small></div>
                <div className="preview-metric"><span>Net cash flow</span><strong className="preview-positive">+₹8,420</strong><small><ArrowUpRight size={13} /> Income minus expenses</small></div>
              </div>
              <div className="preview-chart-card">
                <div className="preview-card-head"><div><span>MONTHLY CASH FLOW</span><strong>In vs. out</strong></div><span className="preview-range">6 months⌄</span></div>
                <div className="preview-chart">
                  {[38, 57, 46, 73, 61, 88, 66, 79, 52, 69, 94, 76].map((height, index) => (
                    <div className="preview-bar-group" key={index}>
                      <span className="preview-bar-income" style={{ height: `${height}%` }} />
                      <span className="preview-bar-expense" style={{ height: `${Math.max(14, height * 0.58)}%` }} />
                    </div>
                  ))}
                </div>
                <div className="preview-legend"><span><i className="legend-income" /> Income</span><span><i className="legend-expense" /> Expenses</span></div>
              </div>
              <div className="preview-holdings">
                <div className="preview-card-head"><div><span>INVESTMENTS</span><strong>Keep an eye on the future</strong></div><span className="preview-link">Portfolio ↗</span></div>
                <div className="preview-holding-row"><span className="preview-holding-icon fd"><Landmark size={15} /></span><span className="preview-holding-name"><strong>Fixed deposit</strong><small>Next: maturity estimate</small></span><span className="preview-holding-value"><strong>Principal + interest</strong><small>Rate &amp; date tracked</small></span></div>
              </div>
            </div>
            <div className="landing-float-card"><span className="landing-float-icon"><Check size={17} /></span><span><strong>One clear picture</strong><small>Daily money, long-term goals</small></span></div>
          </div>
        </section>

        <section className="landing-trust-strip" aria-label="Product principles">
          <div><ShieldCheck size={18} /><span><strong>Private workspace</strong><small>Account-scoped records</small></span></div>
          <div><Banknote size={18} /><span><strong>Built for rupees</strong><small>INR-first tracking</small></span></div>
          <div><ChartNoAxesCombined size={18} /><span><strong>Day-to-day + long-term</strong><small>Cash flow through FDs</small></span></div>
          <div><Sparkles size={18} /><span><strong>Clear by design</strong><small>Useful numbers, less noise</small></span></div>
        </section>

        <section className="landing-section" id="features">
          <div className="landing-section-heading">
            <span className="landing-kicker">MADE FOR YOUR MONEY</span>
            <h2>Small details. <span>Better decisions.</span></h2>
            <p>Keep your daily spending and future plans connected without turning money management into another chore.</p>
          </div>
          <div className="landing-feature-grid">
            {features.map(({ icon: Icon, tint, title, text }) => (
              <article className="landing-feature-card" key={title}>
                <span className={`landing-feature-icon ${tint}`}><Icon size={20} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="landing-feature-arrow"><ArrowRight size={16} /></span>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-fd-band">
          <div className="landing-fd-symbol"><CalendarClock size={25} /></div>
          <div className="landing-fd-copy"><span className="landing-kicker">LONG-TERM MONEY, MADE VISIBLE</span><h2>Your fixed deposits deserve a place in the plan.</h2><p>Record the deposit date, principal, interest rate and maturity. See projected maturity value and estimated interest alongside your other holdings.</p></div>
          <a href="#how-it-works" className="landing-fd-link">See how it works <ArrowRight size={16} /></a>
          <div className="landing-fd-watermark" aria-hidden="true">₹</div>
        </section>

        <section className="landing-section landing-steps-section" id="how-it-works">
          <div className="landing-section-heading">
            <span className="landing-kicker">A SIMPLE START</span>
            <h2>From scattered entries to <span>a clearer trail.</span></h2>
            <p>Start with the information you already have. Add detail only when it helps you.</p>
          </div>
          <div className="landing-steps">
            <article><span className="landing-step-number">01</span><span className="landing-step-icon"><Wallet size={21} /></span><h3>Set up your view</h3><p>Add your accounts and opening balances to establish a useful starting point.</p></article>
            <article><span className="landing-step-number">02</span><span className="landing-step-icon"><ArrowLeftRight size={21} /></span><h3>Record as you go</h3><p>Log transactions, import a statement file, record refunds, or transfer between your accounts.</p></article>
            <article><span className="landing-step-number">03</span><span className="landing-step-icon"><ChartNoAxesCombined size={21} /></span><h3>Review and plan</h3><p>Compare monthly cash flow, follow budgets, track investment value and upcoming FD maturities.</p></article>
          </div>
        </section>

        <section className="landing-privacy-section" id="privacy">
          <div className="landing-privacy-icon"><LockKeyhole size={23} /></div>
          <div><span className="landing-kicker">BUILT AROUND YOUR CONTROL</span><h2>Your financial view should be yours.</h2><p>RupeeTrail uses your signed-in account to protect personal records. You enter account details yourself; your bank password is never needed for transaction tracking.</p></div>
          <div className="landing-privacy-checks"><span><Check size={15} /> Signed-in workspace</span><span><Check size={15} /> Database row-level security</span><span><Check size={15} /> Manual tracking by default</span></div>
        </section>

        <section className="landing-faq-section">
          <div className="landing-section-heading">
            <span className="landing-kicker">GOOD TO KNOW</span>
            <h2>A few quick <span>answers.</span></h2>
          </div>
          <div className="landing-faq-list">
            {faqs.map(({ question, answer }) => (
              <details className="landing-faq" key={question}><summary><span>{question}</span><CircleHelp size={17} /></summary><p>{answer}</p></details>
            ))}
          </div>
        </section>

        <section className="landing-final-cta">
          <div><span className="landing-kicker">YOUR NEXT STEP</span><h2>Start your RupeeTrail.</h2><p>Build a clearer picture of the money you earn, spend, save and invest.</p></div>
          <button className="btn landing-primary" type="button" onClick={onSignIn} disabled={!configured || busy}>{busy ? "Connecting…" : "Get started"} <ArrowRight size={17} /></button>
        </section>
      </main>

      <footer className="landing-footer"><a href="#top" aria-label="RupeeTrail home"><Brand /></a><span>Personal finance, with a clearer view.</span><div><a href="#features">Features</a><a href="#privacy">Privacy</a><button type="button" onClick={onSignIn} disabled={!configured || busy}>Sign in</button></div><small>© {new Date().getFullYear()} RupeeTrail. Track thoughtfully.</small></footer>
    </div>
  );
}
