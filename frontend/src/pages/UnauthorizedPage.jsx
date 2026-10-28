import { useLocation, Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/useAuth';
import { getRoleDestination } from '../utils/roleUtils';

export default function UnauthorizedPage() {
  const { user, isAuthenticated, logoutUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const attemptedPath = location.state?.attemptedPath || 'the requested route';
  const requiredRoles = location.state?.requiredRoles || [];
  const currentRole = user?.role || location.state?.currentRole || 'GUEST';

  const userDestination = user ? getRoleDestination(user.role) : '/login';

  return (
    <AuthLayout
      title="403 — Access Denied"
      subtitle="Your role does not have authorization for this destination"
      badgeText="Security Enforcement"
    >
      <div className="unauthorized-container">
        <div className="unauthorized-icon-wrapper" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            <line x1="8" y1="16" x2="16" y2="16" />
          </svg>
        </div>

        <div className="unauthorized-notice">
          <p>
            You attempted to access <code>{attemptedPath}</code>, which requires{' '}
            <strong>{requiredRoles.length > 0 ? requiredRoles.join(' or ') : 'elevated'}</strong> privileges.
          </p>
          <div className="unauthorized-role-chip">
            <span>Your Current Role:</span>
            <strong className="current-role-tag">{currentRole}</strong>
          </div>
        </div>

        <div className="unauthorized-actions">
          {isAuthenticated ? (
            <>
              <button
                type="button"
                className="btn-submit"
                onClick={() => navigate(userDestination)}
              >
                Go to Your {currentRole} Portal →
              </button>
              <button
                type="button"
                className="btn-header-logout w-full"
                onClick={logoutUser}
              >
                Sign In with a Different Account
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-submit text-center-link">
              Sign In to Proceed
            </Link>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
