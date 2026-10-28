import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import FormInput from '../components/FormInput';
import AlertMessage from '../components/AlertMessage';
import { validateEmail } from '../utils/validation';
import { authService } from '../services/authService';
import { useAuth } from '../context/useAuth';
import { getRoleDestination } from '../utils/roleUtils';

const NOT_AUTHORIZED_MESSAGE =
  'These credentials are not authorized for the Admin Portal. Use the Customer Login instead.';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isLoading, loginUser, logoutUser, sessionMessage, setSessionMessage } = useAuth();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeAlert = statusMessage || (sessionMessage ? { type: 'error', text: sessionMessage } : null);

  const validateField = (name, value) => {
    if (name === 'email') return validateEmail(value);
    if (name === 'password') return value ? '' : 'Password is required';
    return '';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);
    setSessionMessage(null);

    const newErrors = {
      email: validateField('email', formData.email),
      password: validateField('password', formData.password),
    };
    setErrors(newErrors);
    setTouched({ email: true, password: true });
    if (newErrors.email || newErrors.password) return;

    setIsSubmitting(true);
    try {
      // 1. Credentials + role are verified by the backend; non-admins get no token.
      const response = await authService.adminLogin({
        email: formData.email,
        password: formData.password,
      });

      // 2. Do not trust the login payload: re-read role/status from the database.
      const profile = await authService.getMe(response.token);

      if (profile?.role !== 'ADMIN' || profile?.status !== 'ACTIVE') {
        // Defense in depth: nothing has been persisted at this point.
        setStatusMessage({ type: 'error', text: NOT_AUTHORIZED_MESSAGE });
        return;
      }

      // 3. Only a verified, ACTIVE admin gets a stored session.
      loginUser({
        token: response.token,
        refreshToken: response.refreshToken,
        user: {
          userId: profile.userId,
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          role: profile.role,
          status: profile.status,
        },
      });

      const intended = location.state?.from?.pathname;
      const destination =
        intended && intended.startsWith('/admin') && intended !== '/admin/login' ? intended : '/admin';
      navigate(destination, { replace: true });
    } catch (err) {
      if (err.code === 'ROLE_NOT_PERMITTED') {
        setStatusMessage({ type: 'error', text: NOT_AUTHORIZED_MESSAGE });
      } else if (err.status === 403 && err.code === 'ACCOUNT_NOT_ACTIVE') {
        // Locked / suspended / inactive / pending: backend refused to issue tokens.
        setStatusMessage({ type: 'error', text: err.message });
      } else {
        setStatusMessage({
          type: 'error',
          text: err.message || 'Admin sign-in failed. Please check your credentials and try again.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="auth-page-wrapper loading-center">
        <div className="loading-card">
          <div className="loading-spinner" aria-hidden="true"></div>
          <div className="loading-text">Loading application...</div>
        </div>
      </div>
    );
  }

  // Already signed in as an admin: go straight to the dashboard (AdminRoute re-verifies).
  if (isAuthenticated && user?.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }

  return (
    <AuthLayout
      title="Admin Sign In"
      subtitle="Restricted to authorized administrators"
      badgeText="Admin Portal"
      compact={true}
    >
      {activeAlert && (
        <AlertMessage
          type={activeAlert.type}
          message={activeAlert.text}
          onDismiss={() => {
            setStatusMessage(null);
            setSessionMessage(null);
          }}
        />
      )}

      {isAuthenticated && user ? (
        <div className="auth-success-card">
          <div className="status-value">{user.name || user.email}</div>
          <p className="admin-login-note">
            You are signed in as <strong>{user.role}</strong>, which cannot access the Admin Portal.
            Sign out to continue with an administrator account.
          </p>
          <div className="session-actions-row">
            <button type="button" className="btn-submit" onClick={() => navigate(getRoleDestination(user.role))}>
              Back to my portal
            </button>
            <button type="button" className="btn-submit btn-secondary-danger" onClick={logoutUser}>
              Sign Out
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="auth-form" id="admin-login-form">
          <FormInput
            id="email"
            label="Admin Email"
            type="email"
            placeholder="admin@example.com"
            value={formData.email}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.email}
            required
            disabled={isSubmitting}
            autoComplete="username"
          />

          <FormInput
            id="password"
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.password}
            required
            disabled={isSubmitting}
            autoComplete="current-password"
          />

          <button type="submit" className="btn-submit" disabled={isSubmitting} id="admin-login-submit">
            {isSubmitting ? 'Verifying...' : 'Sign In to Admin Portal'}
          </button>

          <div className="form-footer-action">
            <Link to="/login" className="text-link font-medium" id="back-to-customer-login">
              ← Back to Customer Login
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
