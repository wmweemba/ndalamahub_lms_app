/**
 * Shared shell for the auth screens (login, forgot-password, reset-password).
 *
 * Layout: a floating card on a page-wide dark region with a slanted edge. The
 * left panel is a deliberate SLOT — swap its contents for a photograph,
 * marketing content, or per-tenant art without touching the layout. Styles
 * live in index.css under `@layer components` (see the note there about why).
 *
 * Visual treatment is a documented exception to UI_SPEC §1.5 — see §12.
 */

// Scaled-up composition of the NdalamaHub mark itself (a hub with three
// spokes, see brand/svg/NdalamaHub-icon.svg) extended into a larger graph.
// Also happens to say the right thing: a hub connecting lenders, officers and
// borrowers. Inline SVG rather than an image so it costs no extra request and
// stays crisp at any size.
function PanelArt() {
  return (
    <svg viewBox="0 0 560 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="nh-auth-halo">
          <stop offset="0%" stopColor="#D6295E" stopOpacity=".40" />
          <stop offset="70%" stopColor="#D6295E" stopOpacity=".07" />
          <stop offset="100%" stopColor="#D6295E" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g stroke="#CCDAD1" strokeOpacity=".08" strokeWidth="1.5" fill="none">
        <path d="M40,640 L230,660" /><path d="M520,600 L360,665" /><path d="M150,40 L420,50" />
      </g>
      <g stroke="#CCDAD1" strokeOpacity=".23" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M280,290 L280,130" /><path d="M280,290 L130,490" /><path d="M280,290 L430,490" />
        <path d="M130,490 L40,640" /><path d="M130,490 L230,660" />
        <path d="M430,490 L520,600" /><path d="M430,490 L360,665" />
        <path d="M280,130 L150,40" /><path d="M280,130 L420,50" />
      </g>
      <g fill="#CCDAD1" fillOpacity=".30">
        <circle cx="280" cy="130" r="14" /><circle cx="130" cy="490" r="14" /><circle cx="430" cy="490" r="14" />
      </g>
      <g fill="#CCDAD1" fillOpacity=".14">
        <circle cx="40" cy="640" r="8" /><circle cx="230" cy="660" r="8" />
        <circle cx="520" cy="600" r="8" /><circle cx="360" cy="665" r="8" />
        <circle cx="150" cy="40" r="8" /><circle cx="420" cy="50" r="8" />
      </g>
      <circle cx="280" cy="290" r="105" fill="url(#nh-auth-halo)" />
      <circle cx="280" cy="290" r="24" fill="#D6295E" />
    </svg>
  );
}

// Lower-contrast copy of the graph, continuing behind the card so the whole
// page reads as one composition with the card floating over it.
function BleedArt() {
  return (
    <svg viewBox="0 0 900 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g stroke="#CCDAD1" strokeOpacity=".13" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M450,420 L450,190" /><path d="M450,420 L215,690" /><path d="M450,420 L690,690" />
        <path d="M215,690 L90,850" /><path d="M690,690 L830,840" />
        <path d="M450,190 L250,90" /><path d="M450,190 L660,80" />
      </g>
      <g fill="#CCDAD1" fillOpacity=".16">
        <circle cx="450" cy="190" r="16" /><circle cx="215" cy="690" r="16" /><circle cx="690" cy="690" r="16" />
        <circle cx="90" cy="850" r="10" /><circle cx="830" cy="840" r="10" />
        <circle cx="250" cy="90" r="10" /><circle cx="660" cy="80" r="10" />
      </g>
      <circle cx="450" cy="420" r="28" fill="#CCDAD1" fillOpacity=".2" />
    </svg>
  );
}

export function AuthLayout({ children, title, subtitle }) {
  return (
    <div className="auth-shell">
      <div className="auth-bleed" aria-hidden="true">
        <BleedArt />
      </div>

      <div className="auth-card">
        {/* ── SLOT: swap PanelArt + copy for a photo, marketing content, or
            per-tenant branding. Nothing else in the layout needs to change. */}
        <div className="auth-panel-wrap">
          <section className="auth-panel">
            <PanelArt />
            <div className="auth-panel-top">
              {/* *-dark.svg is the variant FOR dark backgrounds (white stroke).
                  *-light.svg is charcoal and disappears here. */}
              <img
                className="auth-panel-mark"
                src="/brand/svg/NdalamaHub-lockup-horizontal-dark.svg"
                alt="NdalamaHub"
              />
            </div>
            <div className="auth-panel-bottom">
              <h2 className="auth-panel-title">Loan Management &ndash; End to End</h2>
              <p className="auth-panel-copy">
                Applications, approvals, disbursement, collateral and repayments &mdash; one
                system, built for Zambian lenders.
              </p>
            </div>
          </section>
        </div>

        <section className="auth-form-side">
          <div className="auth-form-wrap">
            {title && <h1 className="auth-title">{title}</h1>}
            {subtitle && <p className="auth-subtitle">{subtitle}</p>}
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
