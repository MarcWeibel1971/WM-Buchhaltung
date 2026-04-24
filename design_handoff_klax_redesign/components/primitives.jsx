/* global React */
// KLAX primitives — small atoms + shared chrome for all pages.

const { useState, useMemo, useEffect, useRef } = React;

// Lucide-ish inline SVG. Minimal set; 16px unless sized.
const Icon = ({ name, size = 16, stroke = 1.6, style }) => {
  const paths = {
    dashboard: 'M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zM13 3v6h8V3h-8z',
    inbox:    'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
    file:     'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6',
    bank:     'M3 21h18 M3 10h18 M5 6l7-3 7 3 M4 10v11 M20 10v11 M8 14v3 M12 14v3 M16 14v3',
    check:    'M20 6 9 17l-5-5',
    receipt:  'M4 2v20l3-2 3 2 3-2 3 2 3-2V2l-3 2-3-2-3 2-3-2-3 2z M8 7h8 M8 11h8 M8 15h4',
    chart:    'M3 3v18h18 M7 14l4-4 4 4 5-5',
    percent:  'M19 5 5 19 M6.5 6.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0 M14.5 17.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
    upload:   'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
    plus:     'M12 5v14 M5 12h14',
    arrow:    'M5 12h14 M12 5l7 7-7 7',
    link:     'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
    sparkle:  'M12 3 14 9l6 2-6 2-2 6-2-6-6-2 6-2z M19 3v4 M21 5h-4',
    search:   'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35',
    bell:     'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10 21a2 2 0 0 0 4 0',
    menu:     'M3 6h18 M3 12h18 M3 18h18',
    x:        'M18 6 6 18 M6 6l12 12',
    chevR:    'm9 18 6-6-6-6',
    chevD:    'm6 9 6 6 6-6',
    eye:      'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    bot:      'M12 8V4H8 M4 12h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z M2 14h2 M20 14h2 M15 13v2 M9 13v2',
    calendar: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z M16 3v4 M8 3v4 M3 11h18',
    users:    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    circle:   'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
    dot:      'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
    warn:     'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01',
    zap:      'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
    wallet:   'M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4 M4 6v12c0 1.1.9 2 2 2h14v-4 M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z',
    card:     'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z M2 10h20',
    pdf:      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 13h6 M9 17h4',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
    filter:   'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
    clock:    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  };
  const d = paths[name] || paths.dot;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" style={style}>
      {d.split(' M ').map((seg, i) => <path key={i} d={(i ? 'M ' : '') + seg} />)}
    </svg>
  );
};

const Pill = ({ variant = 'default', icon, children }) => (
  <span className={`pill ${variant !== 'default' ? `pill--${variant}` : ''}`}>
    {icon && <Icon name={icon} size={11} />}
    {children}
  </span>
);

const Btn = ({ variant = 'default', icon, iconRight, size, children, onClick }) => (
  <button
    onClick={onClick}
    className={`btn ${variant === 'primary' ? 'btn--primary' : ''} ${variant === 'ghost' ? 'btn--ghost' : ''} ${size === 'sm' ? 'btn--sm' : ''}`}
  >
    {icon && <Icon name={icon} size={14} />}
    {children}
    {iconRight && <Icon name={iconRight} size={14} />}
  </button>
);

const Conf = ({ value }) => (
  <span className="conf">
    <span className="conf-bar"><i style={{ width: `${value}%` }} /></span>
    {value}%
  </span>
);

// Logo
const Logo = ({ size = 18 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{
      width: 24, height: 24, borderRadius: 7,
      background: 'var(--accent)', color: 'var(--accent-ink)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13,
      letterSpacing: '-0.04em',
    }}>K</div>
    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: size, letterSpacing: '-0.02em' }}>
      klax
    </span>
  </div>
);

// Sidebar
const Sidebar = ({ active = 'dashboard' }) => {
  const NavItem = ({ id, icon, label, badge, sub }) => (
    <div className={`sb-item ${active === id ? 'sb-item--active' : ''} ${sub ? 'sb-sub' : ''}`}>
      {icon && <Icon name={icon} size={15} stroke={1.7} />}
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          fontSize: 10.5, fontFamily: 'var(--font-mono)',
          padding: '1px 6px', borderRadius: 999,
          background: active === id ? 'rgba(255,255,255,0.16)' : 'var(--surface-2)',
          color: active === id ? 'var(--accent-ink)' : 'var(--ink-3)',
        }}>{badge}</span>
      )}
    </div>
  );

  return (
    <aside className="sidebar">
      <div style={{ padding: '4px 8px 16px' }}>
        <Logo />
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', margin: '0 0 10px',
        borderRadius: 6, background: 'var(--surface-2)', fontSize: 12, color: 'var(--ink-2)'
      }}>
        <Icon name="search" size={13} />
        <span style={{ flex: 1, color: 'var(--ink-4)' }}>Suchen oder fragen…</span>
        <span className="kbd">⌘K</span>
      </div>

      <NavItem id="dashboard" icon="dashboard" label="Dashboard" />
      <NavItem id="inbox" icon="inbox" label="Inbox" badge="7" />

      <div className="sb-group">Belege</div>
      <NavItem id="belege" icon="file" label="Alle Belege" badge="124" />
      <NavItem id="belege-new" label="Neu hochgeladen" sub />
      <NavItem id="belege-ai" label="KI-verarbeitet" sub />
      <NavItem id="belege-check" label="Zu prüfen" sub />

      <div className="sb-group">Bank & Zahlungen</div>
      <NavItem id="bank" icon="bank" label="Banktransaktionen" badge="3" />
      <NavItem id="bank-unmatched" label="Ungematcht" sub />
      <NavItem id="bank-konten" label="Konten & Karten" sub />
      <NavItem id="kreditoren" icon="wallet" label="Kreditoren" badge="9" />
      <NavItem id="offene-posten" label="Offene Posten" sub />

      <div className="sb-group">Freigaben</div>
      <NavItem id="freigaben" icon="check" label="Bereit zur Freigabe" badge="12" />
      <NavItem id="freigaben-warn" label="Mit Warnungen" sub />
      <NavItem id="freigaben-booked" label="Verbucht" sub />

      <div className="sb-group">Rechnungen</div>
      <NavItem id="rechnungen" icon="receipt" label="Ausgangsrechnungen" />
      <NavItem id="rechnungen-offen" label="Offene Forderungen" sub />
      <NavItem id="rechnungen-mahn" label="Mahnwesen" sub />

      <div className="sb-group">Buchhaltung</div>
      <NavItem id="kontenplan" icon="pdf" label="Kontenplan" />
      <NavItem id="kontendetail" label="Kontendetail" sub />

      <div className="sb-group">Berichte</div>
      <NavItem id="berichte" icon="chart" label="Erfolgsrechnung" />
      <NavItem id="bilanz" label="Bilanz" sub />
      <NavItem id="cashflow" label="Cashflow" sub />

      <div className="sb-group">Abschluss</div>
      <NavItem id="mwst" icon="percent" label="MWST" />
      <NavItem id="abschluss" label="Jahresabschluss" sub />

      <div className="sb-group">Admin</div>
      <NavItem id="rules" icon="bot" label="KI-Regeln" />

      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <div className="divider" style={{ marginBottom: 12 }} />
        <NavItem id="settings" icon="settings" label="Einstellungen" />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 8px', marginTop: 4
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 999,
            background: 'var(--accent-soft)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 11
          }}>WM</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink)' }}>Weibel-Müller AG</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>GJ 2026 · R. Müller</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

// Topbar
const Topbar = ({ title, subtitle, actions, breadcrumbs }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    padding: '28px 32px 20px', gap: 24,
    borderBottom: '1px solid var(--hair)'
  }}>
    <div>
      {breadcrumbs && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
          {breadcrumbs.map((b, i) => (
            <React.Fragment key={i}>
              {i > 0 && <Icon name="chevR" size={11} />}
              <span>{b}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      <h1 className="display" style={{
        margin: 0, fontSize: 28, letterSpacing: '-0.025em',
        fontWeight: 500, color: 'var(--ink)'
      }}>{title}</h1>
      {subtitle && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>{subtitle}</div>}
    </div>
    {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
  </div>
);

// Page frame (sidebar + content area). 1440×900 default.
const Frame = ({ active, children, width = 1440, height = 900 }) => (
  <div className="klax" style={{
    width, height, display: 'flex',
    overflow: 'hidden',
    background: 'var(--paper)'
  }}>
    <Sidebar active={active} />
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {children}
    </main>
  </div>
);

// Copilot dock (bottom-right)
const CopilotDock = ({ variant = 'collapsed' }) => {
  if (variant === 'collapsed') {
    return (
      <div style={{
        position: 'absolute', right: 24, bottom: 24,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px 10px 12px',
        background: 'var(--ink)', color: '#F4F1EA',
        borderRadius: 999,
        boxShadow: '0 14px 40px -12px rgba(23,20,15,.35), 0 2px 6px rgba(23,20,15,.12)',
        fontSize: 13, zIndex: 5,
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 999,
          background: 'linear-gradient(135deg, #E6DBF5, #B9A7E0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ai)'
        }}>
          <Icon name="sparkle" size={12} stroke={2} />
        </div>
        <span>Frag Klax …</span>
        <span className="kbd" style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.15)', color: '#D9D3C6' }}>⌘J</span>
      </div>
    );
  }
  return null;
};

// Expose
Object.assign(window, { Icon, Pill, Btn, Conf, Logo, Sidebar, Topbar, Frame, CopilotDock });
