import { useState } from 'react';
import AuthLayout from '../../components/AuthLayout';
import ChangePasswordCard from '../../components/ChangePasswordCard';
import AlertMessage from '../../components/AlertMessage';
import { useAuth } from '../../context/useAuth';
import { adminService } from '../../services/adminService';

function parseUserId(raw) {
  const trimmed = String(raw).trim();
  if (!/^\d+$/.test(trimmed) || Number(trimmed) <= 0) return null;
  return trimmed;
}

/** Look up a user by ID — GET /api/users/:userId (ADMIN allowed by backend). */
function UserLookupCard() {
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setAlert(null);
    setResult(null);
    const id = parseUserId(userId);
    if (!id) {
      setError('Enter a valid numeric user ID');
      return;
    }
    setError('');
    setBusy(true);
    try {
      setResult(await adminService.getUser(id));
    } catch (err) {
      setAlert({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-card" aria-labelledby="admin-lookup-title">
      <h3 id="admin-lookup-title" className="admin-card-title">User Lookup</h3>
      <p className="admin-card-desc">View an account&apos;s role and status by user ID.</p>
      {alert && <AlertMessage type={alert.type} message={alert.text} onDismiss={() => setAlert(null)} />}
      <form onSubmit={submit} noValidate className="admin-inline-form">
        <div className="form-group">
          <label htmlFor="lookup-user-id" className="form-label">User ID</label>
          <input
            id="lookup-user-id"
            className="form-input"
            inputMode="numeric"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={busy}
            aria-invalid={Boolean(error)}
          />
          {error && <div className="field-error" role="alert">{error}</div>}
        </div>
        <button type="submit" className="btn-submit" disabled={busy} id="lookup-submit">
          {busy ? 'Searching...' : 'Look Up'}
        </button>
      </form>
      {result && (
        <div className="portal-meta-grid admin-result" id="lookup-result">
          <div className="meta-item"><span className="meta-label">Name</span><span className="meta-val">{result.name}</span></div>
          <div className="meta-item"><span className="meta-label">Email</span><span className="meta-val">{result.email}</span></div>
          <div className="meta-item"><span className="meta-label">Role</span><span className="detail-badge role-badge">{result.role}</span></div>
          <div className="meta-item"><span className="meta-label">Status</span><span className="detail-badge status-badge">{result.status}</span></div>
        </div>
      )}
    </section>
  );
}

/** Unlock a LOCKED account — POST /api/admin/users/:userId/unlock (MANAGE_USERS). */
function UnlockAccountCard() {
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [alert, setAlert] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setAlert(null);
    const id = parseUserId(userId);
    if (!id) {
      setError('Enter a valid numeric user ID');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await adminService.unlockUser(id);
      setAlert({ type: 'success', text: `Account #${id} unlocked.` });
      setUserId('');
    } catch (err) {
      setAlert({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-card" aria-labelledby="admin-unlock-title">
      <h3 id="admin-unlock-title" className="admin-card-title">Unlock Account</h3>
      <p className="admin-card-desc">Restore a locked account (locked after too many failed logins).</p>
      {alert && <AlertMessage type={alert.type} message={alert.text} onDismiss={() => setAlert(null)} />}
      <form onSubmit={submit} noValidate className="admin-inline-form">
        <div className="form-group">
          <label htmlFor="unlock-user-id" className="form-label">User ID</label>
          <input
            id="unlock-user-id"
            className="form-input"
            inputMode="numeric"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={busy}
            aria-invalid={Boolean(error)}
          />
          {error && <div className="field-error" role="alert">{error}</div>}
        </div>
        <button type="submit" className="btn-submit" disabled={busy} id="unlock-submit">
          {busy ? 'Unlocking...' : 'Unlock Account'}
        </button>
      </form>
    </section>
  );
}

export default function AdminPortal() {
  const { user, logoutUser } = useAuth();

  return (
    <AuthLayout
      title="Admin Dashboard"
      subtitle="Identity & access administration"
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
              <span className="detail-badge role-badge admin-badge">{user?.role}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Status</span>
              <span className="detail-badge status-badge">{user?.status}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Admin ID</span>
              <span className="meta-val">#{user?.userId}</span>
            </div>
          </div>
        </div>

        <div className="admin-grid">
          <UserLookupCard />
          <UnlockAccountCard />
        </div>

        <ChangePasswordCard />

        <div className="team-boundary-callout">
          <div className="boundary-header">
            <strong>Not yet available (no backend endpoint)</strong>
          </div>
          <div className="integration-notes">
            <span>• Listing / searching all users</span>
            <span>• Suspending, deactivating or reactivating accounts</span>
            <span>• Creating staff accounts or changing roles</span>
            <span>• Viewing the audit log (VIEW_AUDIT_LOG)</span>
          </div>
          <p className="boundary-subnote">
            <em>These need new secured backend routes; none were invented on the frontend.</em>
          </p>
        </div>

        <div className="portal-actions">
          <button type="button" className="btn-submit btn-secondary-danger" onClick={logoutUser} id="admin-signout">
            Sign Out
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
