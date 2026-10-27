import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { isRoleAllowed } from '../utils/roleUtils';

export default function ProtectedRoute({ allowedRoles = [], children }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="auth-page-wrapper loading-center">
        <div className="loading-card">
          <div className="loading-spinner" aria-hidden="true"></div>
          <div className="loading-text">Verifying security session...</div>
        </div>
      </div>
    );
  }

  // Not authenticated: redirect to login and preserve intended path
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated, but role does not match requirements: redirect to unauthorized
  if (allowedRoles.length > 0 && !isRoleAllowed(user.role, allowedRoles)) {
    return (
      <Navigate
        to="/unauthorized"
        state={{
          attemptedPath: location.pathname,
          requiredRoles: allowedRoles,
          currentRole: user.role,
        }}
        replace
      />
    );
  }

  // Authenticated and authorized
  return children;
}
