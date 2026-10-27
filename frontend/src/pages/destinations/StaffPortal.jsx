import ChangePasswordCard from '../../components/ChangePasswordCard';
import { useAuth } from '../../context/useAuth';

export default function StaffPortal() {
  const { user, logoutUser } = useAuth();

  return (
    <section className="embedded-portal">
      <header className="embedded-portal-header">
        <h1 className="section-title">Railway Staff Portal</h1>
        <p className="section-subtitle">Operational identity gateway for authorized railway personnel</p>
      </header>
      <div className="destination-portal-content">
        <div className="portal-welcome-card staff-accent">
          <div className="portal-user-hero">
            <div className="portal-avatar staff-avatar" aria-hidden="true">
              {user?.name ? user.name[0].toUpperCase() : 'S'}
            </div>
            <div>
              <h2 className="portal-username">{user?.name || 'Railway Staff Member'}</h2>
              <span className="portal-email">{user?.email}</span>
            </div>
          </div>

          <div className="portal-meta-grid">
            <div className="meta-item">
              <span className="meta-label">Role</span>
              <span className="detail-badge role-badge">STAFF</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Status</span>
              <span className="detail-badge status-badge">{user?.status || 'ACTIVE'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Access Level</span>
              <span className="meta-val">Staff Operations</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Staff ID</span>
              <span className="meta-val">#{user?.userId || 'N/A'}</span>
            </div>
          </div>
        </div>

        <ChangePasswordCard />

        <div className="team-boundary-callout">
          <div className="boundary-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <strong>Role Permissions (docs/API.md)</strong>
          </div>
          <p>
            You are authenticated under the <strong>STAFF</strong> role. Backend-documented permissions assigned to this role:
          </p>
          <div className="integration-notes">
            <span>• <code>VIEW_PASSENGER</code>: Authorized to view passenger travel details and reservation manifests.</span>
          </div>
          <p className="boundary-subnote">
            <em>Team 1 Scope: Authentication and token lifecycle. Operational staff consoles and passenger manifest displays interface with this Bearer token via backend middleware.</em>
          </p>
        </div>

        <div className="portal-actions">
          <button
            type="button"
            className="btn-submit btn-secondary-danger"
            onClick={logoutUser}
          >
            Sign Out
          </button>
        </div>
      </div>
    </section>
  );
}
