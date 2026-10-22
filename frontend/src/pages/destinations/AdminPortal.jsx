import AuthLayout from '../../components/AuthLayout';
import ChangePasswordCard from '../../components/ChangePasswordCard';
import { useAuth } from '../../context/useAuth';

export default function AdminPortal() {
  const { user, logoutUser } = useAuth();

  return (
    <AuthLayout
      title="System Administration Portal"
      subtitle="Elevated control and user management interface"
      badgeText="Administrator Session"
    >
      <div className="destination-portal-content">
        <div className="portal-welcome-card admin-accent">
          <div className="portal-user-hero">
            <div className="portal-avatar admin-avatar" aria-hidden="true">
              {user?.name ? user.name[0].toUpperCase() : 'A'}
            </div>
            <div>
              <h2 className="portal-username">{user?.name || 'System Administrator'}</h2>
              <span className="portal-email">{user?.email}</span>
            </div>
          </div>

          <div className="portal-meta-grid">
            <div className="meta-item">
              <span className="meta-label">Role</span>
              <span className="detail-badge role-badge admin-badge">ADMIN</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Status</span>
              <span className="detail-badge status-badge">{user?.status || 'ACTIVE'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Privilege Tier</span>
              <span className="meta-val">Full RBAC Administrative</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Admin ID</span>
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
            You are authenticated under the <strong>ADMIN</strong> role. Backend-documented permissions assigned to this role:
          </p>
          <div className="integration-notes">
            <span>• <code>MANAGE_USERS</code>: User management and unlocking locked accounts (<code>POST /api/admin/users/:userId/unlock</code>).</span>
            <span>• <code>MANAGE_STAFF</code> &amp; <code>MANAGE_ROLES</code>: Staff role provisioning.</span>
            <span>• <code>VIEW_AUDIT_LOG</code>: Audit ledger access for authentication and security events.</span>
            <span>• <code>MANAGE_MASTER_DATA</code> &amp; <code>VIEW_PASSENGER</code>: Cross-system administrative visibility.</span>
          </div>
          <p className="boundary-subnote">
            <em>Team 1 Scope: Authentication, token verification, and user unlocking. Specialized fleet and scheduling admin consoles are maintained by partner teams.</em>
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
