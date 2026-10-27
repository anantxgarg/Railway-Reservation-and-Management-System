import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { getRoleDestination } from '../utils/roleUtils';
import ThemeToggle from './ThemeToggle';

export default function AuthLayout({
  title,
  subtitle,
  children,
  badgeText = 'Railway Reservation',
  isHero = false,
  compact = false,
}) {
  const { user, isAuthenticated, logoutUser } = useAuth();
  const navigate = useNavigate();

  const handlePortalNavigate = () => {
    if (user?.role) {
      navigate(getRoleDestination(user.role));
    }
  };

  return (
    <div className="auth-page-wrapper">
      {/* --------------------------------------------------------------------------
          Fixed continuous railway background & subtle overlay covering entire page
          Light Mode: Static railway image (/hero-bg.jpg)
          Dark Mode: Static railway image (/hero-bg-dark.png)
          (No video used in either theme)
          -------------------------------------------------------------------------- */}
      <div className="app-fixed-background" aria-hidden="true" />
      <div className="app-fixed-overlay" aria-hidden="true" />

      {/* --------------------------------------------------------------------------
          Fixed Solid Opaque Navbar
          -------------------------------------------------------------------------- */}
      <header className="translucent-glass-navbar">
        <div className="navbar-container">
          <Link to="/" className="brand-link" aria-label="Safar Home">
            <div className="brand-logo" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="3" width="16" height="14" rx="2" />
                <path d="M4 11h16" />
                <path d="M12 3v8" />
                <path d="m8 17-2 4" />
                <path d="m16 17 2 4" />
                <circle cx="9" cy="14" r="1" />
                <circle cx="15" cy="14" r="1" />
              </svg>
            </div>
            <div className="brand-text">
              <span className="brand-title">Safar</span>
              <span className="brand-tag">{badgeText}</span>
            </div>
          </Link>

          {/* Main Navigation Links */}
          <nav className="navbar-nav-links" aria-label="Main Navigation">
            {isHero ? (
              <>
                <a href="/#reservations" className="nav-item-link">Reservations</a>
                <a href="/#train-info" className="nav-item-link">Train Information</a>
                <a href="/#assistance" className="nav-item-link">Travel Assistance</a>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-item-link">Sign In</Link>
                <Link to="/register" className="nav-item-link">Create Account</Link>
              </>
            )}
          </nav>

          {/* Navbar Auth Action */}
          <div className="navbar-auth-action">
            <ThemeToggle />
            {isAuthenticated && user ? (
              <div className="navbar-user-session">
                <button
                  type="button"
                  className="user-session-chip"
                  onClick={handlePortalNavigate}
                  title="Go to role portal"
                >
                  <span className="user-avatar-badge" aria-hidden="true">
                    {user.name ? user.name[0].toUpperCase() : 'U'}
                  </span>
                  <div className="user-chip-text">
                    <span className="user-chip-name">{user.name || user.email}</span>
                    <span className="user-chip-role">{user.role}</span>
                  </div>
                </button>
                <button
                  type="button"
                  className="btn-nav-logout"
                  onClick={logoutUser}
                  title="Sign out of current session"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn-nav-login">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------------------
          Main Content Area (Padded to clear fixed navbar)
          -------------------------------------------------------------------------- */}
      <div className="auth-page-content">
        {isHero ? (
          <div className="hero-page-layout">
            {/* Full-Width Hero Section */}
            <section className="hero-full-width" aria-label="Safar Railway Reservation Gateway">
              <div className="hero-content-container">
                {/* Left Column: Compact, Vertically Arranged Login Card */}
                <div className="hero-login-column" id="hero-login">
                  <div className="glass-login-card">
                    <div className="login-card-header">
                      <div className="safar-card-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="4" y="3" width="16" height="14" rx="2" />
                          <path d="M4 11h16" />
                          <path d="M12 3v8" />
                          <path d="m8 17-2 4" />
                          <path d="m16 17 2 4" />
                          <circle cx="9" cy="14" r="1" />
                          <circle cx="15" cy="14" r="1" />
                        </svg>
                        <span>Safar</span>
                      </div>
                      <h2 className="login-card-title">{title}</h2>
                      {subtitle && <p className="login-card-subtitle">{subtitle}</p>}
                    </div>

                    <div className="login-card-body">
                      {children}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* --------------------------------------------------------------------------
                Horizontal Safar Introduction Section (Below Login Panel in Both Themes)
                -------------------------------------------------------------------------- */}
            <section className="safar-intro-section" aria-label="Safar Introduction">
              <div className="safar-intro-container">
                <div className="safar-intro-card">
                  {/* Left Column / Primary Branding */}
                  <div className="safar-intro-primary">
                    <div className="safar-intro-brand-badge">
                      <span className="live-status-dot" aria-hidden="true"></span>
                      <span>Safar · National Rail Gateway</span>
                    </div>

                    <h1 className="safar-intro-headline">
                      “Let every journey take you somewhere wonderful.”
                    </h1>

                    <p className="safar-intro-supporting">
                      Sign in and let your next adventure begin.
                    </p>
                  </div>

                  {/* Right Column / Description & Feature Highlights */}
                  <div className="safar-intro-details">
                    <p className="safar-intro-paragraph">
                      Welcome to Safar, your unified national passenger rail gateway. Experience instant PNR verification, express corridor bookings, live telematics, and seamless journeys across India’s rail transit network.
                    </p>

                    <div className="safar-intro-highlights" role="list">
                      <span className="safar-feature-pill" role="listitem">✦ Premier Express Corridors</span>
                      <span className="safar-feature-pill" role="listitem">✦ 24/7 Rail Madad (139)</span>
                      <span className="safar-feature-pill" role="listitem">✦ Instant PNR Verification</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* --------------------------------------------------------------------------
                Informational Sections (Light, translucent panels over continuous background)
                -------------------------------------------------------------------------- */}
            <main className="info-sections-container">
              {/* Quick Services Shortcuts */}
              <section id="quick-services" className="info-section">
                <div className="section-header-centered">
                  <span className="section-pill-tag">Quick Access</span>
                  <h2 className="info-section-title">Passenger Travel Services</h2>
                  <p className="info-section-desc">
                    Instant digital shortcuts for train schedules, real-time booking verification, and passenger trip records.
                  </p>
                </div>

                <div className="info-cards-grid quick-access-grid">
                  <div className="info-glass-card quick-access-card">
                    <div className="quick-card-top">
                      <div className="info-card-icon" aria-hidden="true">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                      </div>
                      <span className="integration-pill">Corridor Schedules</span>
                    </div>
                    <h3 className="info-card-title">Find Trains</h3>
                    <p className="info-card-text">
                      Search national express corridors, intermediate station stoppages, and timetable availability across India’s rail transit network.
                    </p>
                    <div className="quick-access-footer">
                      <a href="#train-info" className="quick-access-link">Explore Fleet &amp; Routes ↓</a>
                    </div>
                  </div>

                  <div className="info-glass-card quick-access-card">
                    <div className="quick-card-top">
                      <div className="info-card-icon" aria-hidden="true">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                      </div>
                      <span className="integration-pill">Live Tracking</span>
                    </div>
                    <h3 className="info-card-title">PNR Status</h3>
                    <p className="info-card-text">
                      Verify your 10-digit Passenger Name Record for confirmed coach allocation, berth numbers, and chart preparation states prior to departure.
                    </p>
                    <div className="quick-access-footer">
                      <a href="#reservations" className="quick-access-link">View PNR Details ↓</a>
                    </div>
                  </div>

                  <div className="info-glass-card quick-access-card">
                    <div className="quick-card-top">
                      <div className="info-card-icon" aria-hidden="true">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                      <span className="integration-pill">Passenger Portal</span>
                    </div>
                    <h3 className="info-card-title">My Bookings</h3>
                    <p className="info-card-text">
                      Access issued Electronic Reservation Slips (ERS), journey history, and manage personal trip itineraries directly after signing in.
                    </p>
                    <div className="quick-access-footer">
                      <Link to="/login" className="quick-access-link">Sign In to View Trips →</Link>
                    </div>
                  </div>
                </div>
              </section>

              {/* Why Safar? Section */}
              <section id="why-safar" className="info-section">
                <div className="section-header-centered">
                  <span className="section-pill-tag">Why Choose Us</span>
                  <h2 className="info-section-title">Why Safar?</h2>
                  <p className="info-section-desc">
                    Modern, dependable, and passenger-centric rail journey management built for India’s travelers.
                  </p>
                </div>

                <div className="info-cards-grid">
                  <div className="info-glass-card">
                    <div className="info-card-icon" aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    </div>
                    <h3 className="info-card-title">Instant Quota Allocation</h3>
                    <p className="info-card-text">
                      Streamlined booking across General (GN), emergency Tatkal (CK), Ladies (LD), and Senior Citizen lower-berth priority seating.
                    </p>
                  </div>

                  <div className="info-glass-card">
                    <div className="info-card-icon" aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </div>
                    <h3 className="info-card-title">Secure Unified Identity</h3>
                    <p className="info-card-text">
                      Role-based access control protecting customer, staff, and admin accounts with encrypted tokens and multi-device session compliance.
                    </p>
                  </div>

                  <div className="info-glass-card">
                    <div className="info-card-icon" aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </div>
                    <h3 className="info-card-title">24/7 Rail Madad (139)</h3>
                    <p className="info-card-text">
                      Direct connection to universal passenger care, medical emergency coordination on running trains, and prompt passenger grievance redressal.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 1: Reservations */}
              <section id="reservations" className="info-section">
                <div className="section-header-centered">
                  <span className="section-pill-tag">Passenger Ticketing</span>
                  <h2 className="info-section-title">Railway Reservation Services</h2>
                  <p className="info-section-desc">
                    Explore structured ticket booking quotas, real-time PNR tracking, and electronic ticketing guidelines designed for smooth passenger transit.
                  </p>
                </div>

                <div className="info-cards-grid">
                  <div className="info-glass-card">
                    <div className="info-card-icon" aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                    <h3 className="info-card-title">Booking Quotas &amp; Allocations</h3>
                    <p className="info-card-text">
                      Reservations open across dedicated quotas: <strong>General Quota (GN)</strong>, emergency <strong>Tatkal (CK)</strong> and <strong>Premium Tatkal (PT)</strong>, specialized <strong>Ladies Quota (LD)</strong>, and dedicated <strong>Senior Citizen</strong> lower-berth priority seating.
                    </p>
                  </div>

                  <div className="info-glass-card">
                    <div className="info-card-icon" aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                    </div>
                    <h3 className="info-card-title">10-Digit PNR Verification</h3>
                    <p className="info-card-text">
                      Every issued reservation includes a unique 10-digit Passenger Name Record (PNR). Instantly verify confirmation status, berth/coach numbers, chart preparation states, and waitlist progress prior to departure.
                    </p>
                  </div>

                  <div className="info-glass-card">
                    <div className="info-card-icon" aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                    </div>
                    <h3 className="info-card-title">Electronic Reservation Slips (ERS)</h3>
                    <p className="info-card-text">
                      Carry paperless mobile tickets (ERS/VRM) alongside valid national government ID cards. Automated refund protocols apply seamlessly upon confirmed ticket cancellation within prescribed departure windows.
                    </p>
                  </div>
                </div>
                <div className="team-subsystem-callout">
                  <em>* Informational summary. Direct booking engine, seat inventory calculation, and payment transactions are fulfilled by partner subsystem teams.</em>
                </div>
              </section>

              {/* Section 2: Train Information */}
              <section id="train-info" className="info-section">
                <div className="section-header-centered">
                  <span className="section-pill-tag">Fleet &amp; Schedules</span>
                  <h2 className="info-section-title">Train Network &amp; Fleet Information</h2>
                  <p className="info-section-desc">
                    Connecting over 7,300 stations nationwide with high-speed express corridors, iconic long-distance trunks, and intercity passenger connections.
                  </p>
                </div>

                <div className="info-cards-grid">
                  <div className="info-glass-card">
                    <div className="info-card-icon" aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    </div>
                    <h3 className="info-card-title">Premier Express Fleet</h3>
                    <p className="info-card-text">
                      Experience world-class semi-high-speed rail on <strong>Vande Bharat Express</strong> trains, overnight premium luxury aboard <strong>Rajdhani Express</strong>, and rapid daylight connectivity with executive chair cars on <strong>Shatabdi Express</strong>.
                    </p>
                  </div>

                  <div className="info-glass-card">
                    <div className="info-card-icon" aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                    </div>
                    <h3 className="info-card-title">Major National Corridors</h3>
                    <p className="info-card-text">
                      High-capacity routes linking economic hubs: New Delhi – Mumbai Central (Western Trunk), Howrah – New Delhi (Grand Chord), Chennai Central – Bengaluru, and Jammu Tawi – Kanyakumari trans-national lines.
                    </p>
                  </div>

                  <div className="info-glass-card">
                    <div className="info-card-icon" aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <h3 className="info-card-title">Station Platforms &amp; Telemetry</h3>
                    <p className="info-card-text">
                      Real-time GPS locomotive tracking feeds continuous platform allocation displays, station stoppage manifests, and automated SMS notifications to ensure passengers reach boarding gates on time.
                    </p>
                  </div>
                </div>
                <div className="team-subsystem-callout">
                  <em>* Informational summary. Fleet telematics, crew rosters, and live dispatch data are governed by the train operations subsystem.</em>
                </div>
              </section>

              {/* Section 3: Travel Assistance */}
              <section id="assistance" className="info-section">
                <div className="section-header-centered">
                  <span className="section-pill-tag">Passenger Care</span>
                  <h2 className="info-section-title">Passenger Travel Assistance</h2>
                  <p className="info-section-desc">
                    Dedicated round-the-clock passenger support, emergency response helplines, catering services, and accessible station facilities.
                  </p>
                </div>

                <div className="info-cards-grid">
                  <div className="info-glass-card">
                    <div className="info-card-icon" aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </div>
                    <h3 className="info-card-title">Rail Madad 24/7 Helpline (139)</h3>
                    <p className="info-card-text">
                      Universal single-window emergency helpline <strong>139</strong> handles safety emergencies, medical assistance on running trains, clean my coach requests, and immediate passenger grievance redressal.
                    </p>
                  </div>

                  <div className="info-glass-card">
                    <div className="info-card-icon" aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
                        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
                        <line x1="6" y1="1" x2="6" y2="4" />
                        <line x1="10" y1="1" x2="10" y2="4" />
                        <line x1="14" y1="1" x2="14" y2="4" />
                      </svg>
                    </div>
                    <h3 className="info-card-title">Onboard &amp; E-Catering Services</h3>
                    <p className="info-card-text">
                      Enjoy verified meals prepared in certified base kitchens. Pre-order diet preferences or book e-catering from partner restaurants delivered directly to your coach seat via PNR verification.
                    </p>
                  </div>

                  <div className="info-glass-card">
                    <div className="info-card-icon" aria-hidden="true">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 8v4" />
                        <path d="M12 16h.01" />
                      </svg>
                    </div>
                    <h3 className="info-card-title">Accessibility &amp; Special Needs</h3>
                    <p className="info-card-text">
                      Wheelchair assistance, battery-operated passenger carts, ramps, and dedicated assistance booths are available at major stations for senior citizens, expectant mothers, and differently-abled travelers.
                    </p>
                  </div>
                </div>
                <div className="team-subsystem-callout">
                  <em>* Informational summary. Passenger service desks and catering operations are managed by designated railway administrative departments.</em>
                </div>
              </section>
            </main>
          </div>
        ) : (
          /* Non-Hero / Dedicated Page Layout (Register, Forgot, Reset, Portals) */
          <main className={`dedicated-page-wrapper ${compact ? 'login-page-wrapper' : ''}`}>
            <div className={`dedicated-card-container ${compact ? 'compact-card' : ''}`}>
              <div className="glass-content-card">
                <div className="card-header">
                  {compact && (
                    <div className="safar-card-badge">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="4" y="3" width="16" height="14" rx="2" />
                        <path d="M4 11h16" />
                        <path d="M12 3v8" />
                        <path d="m8 17-2 4" />
                        <path d="m16 17 2 4" />
                        <circle cx="9" cy="14" r="1" />
                        <circle cx="15" cy="14" r="1" />
                      </svg>
                      <span>Safar</span>
                    </div>
                  )}
                  <h1 className="card-title">{title}</h1>
                  {subtitle && <p className="card-subtitle">{subtitle}</p>}
                </div>

                <div className="card-body">
                  {children}
                </div>
              </div>
            </div>
          </main>
        )}
      </div>

      {/* --------------------------------------------------------------------------
          Translucent Footer
          -------------------------------------------------------------------------- */}
      <footer className="portal-footer">
        <div className="footer-container">
          <div className="footer-top-row">
            <div className="footer-brand-info">
              <span className="footer-sys-name">SAFAR · RAILWAY RESERVATION</span>
              <p className="footer-tagline">
                Let every journey take you somewhere wonderful.
              </p>
            </div>
            <div className="footer-nav-links">
              <a href="/#reservations">Reservations</a>
              <a href="/#train-info">Train Information</a>
              <a href="/#assistance">Travel Assistance</a>
              <Link to="/login">Sign In</Link>
            </div>
          </div>
          <div className="footer-bottom-row">
            <span>Compliant with Indian Railway RBAC Cyber Security Standards</span>
            <span className="footer-sep">·</span>
            <span>Multi-Device Session Management Enabled</span>
            <span className="footer-sep">·</span>
            <span>All rights reserved</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
