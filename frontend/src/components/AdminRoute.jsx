import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { authService } from '../services/authService';

/**
 * Guard for every Admin Portal page.
 *
 * The role/status held in localStorage is only a hint for routing. Before any
 * admin UI renders, the session is re-verified against GET /api/auth/me, which
 * reads the role and status fresh from the database. Fails closed: if the
 * backend cannot confirm ADMIN + ACTIVE, the admin UI is never shown.
 * (Every admin API call is independently authorised by the backend as well.)
 */
export default function AdminRoute({ children }) {
  const { user, token, isAuthenticated, isLoading, clearLocalAuth, setSessionMessage } = useAuth();
  const location = useLocation();
  const [verified, setVerified] = useState(false);
  const [denied, setDenied] = useState(false);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !token) return undefined;
    let active = true;

    authService
      .getMe(token)
      .then((profile) => {
        if (!active) return;
        if (profile?.role === 'ADMIN' && profile?.status === 'ACTIVE') {
          setVerified(true);
        } else {
          setDenied(true);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err.status === 401) {
          clearLocalAuth();
          setSessionMessage('Your session has expired. Please sign in again.');
        } else {
          setUnreachable(true);
        }
      });

    return () => {
      active = false;
    };
  }, [isLoading, isAuthenticated, token, clearLocalAuth, setSessionMessage]);

  if (isLoading) return <GuardMessage text="Verifying security session..." spinner />;

  if (!isAuthenticated || !user) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (denied || (user.role !== 'ADMIN' && !verified)) {
    return (
      <Navigate
        to="/unauthorized"
        state={{ attemptedPath: location.pathname, requiredRoles: ['ADMIN'], currentRole: user.role }}
        replace
      />
    );
  }

  if (unreachable) {
    return <GuardMessage text="Unable to verify administrator session. Check the backend connection and refresh." />;
  }

  if (!verified) return <GuardMessage text="Verifying administrator access..." spinner />;

  return children;
}

function GuardMessage({ text, spinner = false }) {
  return (
    <div className="auth-page-wrapper loading-center">
      <div className="loading-card">
        {spinner && <div className="loading-spinner" aria-hidden="true"></div>}
        <div className="loading-text">{text}</div>
      </div>
    </div>
  );
}
