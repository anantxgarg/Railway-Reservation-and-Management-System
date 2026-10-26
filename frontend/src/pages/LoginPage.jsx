import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import FormInput from '../components/FormInput';
import AlertMessage from '../components/AlertMessage';
import { validateEmail } from '../utils/validation';
import { authService } from '../services/authService';
import { useAuth } from '../context/useAuth';
import { getRoleDestination } from '../utils/roleUtils';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, loginUser, logoutUser, sessionMessage, setSessionMessage } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive alert from explicit statusMessage or sessionMessage
  const activeAlert = statusMessage || (sessionMessage ? { type: 'error', text: sessionMessage } : null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (touched[name]) {
      let fieldError = '';
      if (name === 'email') fieldError = validateEmail(value);
      if (name === 'password') {
        fieldError = !value ? 'Password is required' : '';
      }
      setErrors((prev) => ({ ...prev, [name]: fieldError }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));

    let fieldError = '';
    if (name === 'email') fieldError = validateEmail(value);
    if (name === 'password') {
      fieldError = !value ? 'Password is required' : '';
    }
    setErrors((prev) => ({ ...prev, [name]: fieldError }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);

    // Client-side validation
    const emailError = validateEmail(formData.email);
    const passwordError = !formData.password ? 'Password is required' : '';

    const newErrors = {
      email: emailError,
      password: passwordError,
    };

    setErrors(newErrors);
    setTouched({ email: true, password: true });

    if (emailError || passwordError) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authService.login({
        email: formData.email,
        password: formData.password,
      });

      // Update AuthContext and token storage
      loginUser(response);

      const intendedPath = location.state?.from?.pathname;
      let destination = getRoleDestination(response.user?.role);
      if (intendedPath && intendedPath !== '/login' && intendedPath !== '/') {
        const allowedRoles =
          intendedPath.startsWith('/admin') ? ['ADMIN'] :
          intendedPath.startsWith('/staff') ? ['STAFF'] :
          intendedPath.startsWith('/customer') ? ['CUSTOMER'] : [];

        if (allowedRoles.length === 0 || allowedRoles.includes(response.user?.role)) {
          destination = intendedPath;
        }
      }
      navigate(destination, { replace: true });
    } catch (err) {
      // Map backend validation field errors if provided
      if (err.fields && err.fields.length > 0) {
        const backendFieldErrors = {};
        err.fields.forEach((item) => {
          if (item.field) {
            backendFieldErrors[item.field] = item.message;
          }
        });
        setErrors((prev) => ({ ...prev, ...backendFieldErrors }));
      }

      setStatusMessage({
        type: 'error',
        text: err.message || 'Login failed. Please check your credentials and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={isAuthenticated ? 'Active Session' : 'Welcome Back'}
      subtitle={isAuthenticated ? 'You are currently signed into the railway portal' : null}
      badgeText="Railway Reservation"
      isHero={true}
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
          <div className="session-status-header">
            <span className="live-dot" aria-hidden="true"></span>
            <span className="status-label">Active Authenticated Session</span>
          </div>

          <div className="status-value">{user.name || user.email}</div>

          <div className="user-details-grid">
            <div className="detail-item">
              <span className="detail-label">Email</span>
              <span className="detail-val">{user.email}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Assigned Role</span>
              <span className="detail-badge role-badge">{user.role}</span>
            </div>
            {user.userId && (
              <div className="detail-item">
                <span className="detail-label">User ID</span>
                <span className="detail-val">#{user.userId}</span>
              </div>
            )}
            <div className="detail-item">
              <span className="detail-label">Status</span>
              <span className="detail-badge status-badge">{user.status || 'ACTIVE'}</span>
            </div>
          </div>

          <div className="success-token-info">
            JWT session token stored for authenticated requests. Automatic token rotation is active.
          </div>

          <div className="session-actions-row">
            <button
              type="button"
              className="btn-submit"
              onClick={() => navigate(getRoleDestination(user.role))}
            >
              Enter {user.role} Portal →
            </button>
            <button
              type="button"
              className="btn-submit btn-secondary-danger"
              onClick={logoutUser}
            >
              Sign Out / End Session
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="auth-form">
          <FormInput
            id="email"
            label="Email Address"
            type="email"
            placeholder="name@example.com"
            value={formData.email}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.email}
            required
            disabled={isSubmitting}
            autoComplete="email"
          />

          <div className="password-header-wrapper">
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
            <div className="forgot-password-link-container login-links-row">
              <Link to="/admin/login" className="text-link admin-login-link" id="login-as-admin">
                Login as Admin
              </Link>
              <Link to="/forgot-password" className="text-link forgot-link">
                Forgot Password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            className="btn-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="form-info-callout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Single portal for <strong>Customer</strong>, <strong>Staff</strong>, and <strong>Admin</strong>. Roles are authenticated server-side.</span>
          </div>

          <div className="form-footer-action">
            <span>Don&apos;t have an account? </span>
            <Link to="/register" className="text-link font-medium">
              Create Customer Account
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
