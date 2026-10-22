import AuthLayout from '../../components/AuthLayout';
import ChangePasswordCard from '../../components/ChangePasswordCard';
import { useAuth } from '../../context/useAuth';

export default function CustomerPortal() {
  const { user, logoutUser } = useAuth();

  return (
    <AuthLayout
      title="Customer Portal"
      subtitle="Welcome to your passenger self-service gateway"
      badgeText="Passenger Session"
    >
      <div className="destination-portal-content">
        <div className="portal-welcome-card">
          <div className="portal-user-hero">
            <div className="portal-avatar" aria-hidden="true">
              {user?.name ? user.name[0].toUpperCase() : 'C'}
            </div>
            <div>
              <h2 className="portal-username">{user?.name || 'Valued Passenger'}</h2>
              <span className="portal-email">{user?.email}</span>
            </div>
          </div>

          <div className="portal-meta-grid">
            <div className="meta-item">
              <span className="meta-label">Role</span>
              <span className="detail-badge role-badge">CUSTOMER</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Status</span>
              <span className="detail-badge status-badge">{user?.status || 'ACTIVE'}</span>
            </div>
            {user?.phone && (
              <div className="meta-item">
                <span className="meta-label">Phone</span>
                <span className="meta-val">{user.phone}</span>
              </div>
            )}
            <div className="meta-item">
              <span className="meta-label">User ID</span>
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
            You are authenticated under the <strong>CUSTOMER</strong> role. Backend-documented permissions assigned to this role:
          </p>
          <div className="integration-notes">
            <span>• <code>BOOK_TICKET</code>: Self-service passenger ticket reservations.</span>
            <span>• <code>VIEW_OWN_BOOKING</code>: Access to personal reservation history.</span>
            <span>• <code>CANCEL_OWN_BOOKING</code>: Self-service reservation cancellation.</span>
          </div>
          <p className="boundary-subnote">
            <em>Team 1 Scope: Authentication and token lifecycle. Downstream booking, train scheduling, and payment UI components are implemented by partner teams.</em>
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
    </AuthLayout>
  );
}
