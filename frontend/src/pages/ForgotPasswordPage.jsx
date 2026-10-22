import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import FormInput from '../components/FormInput';
import AlertMessage from '../components/AlertMessage';
import { validateEmail } from '../utils/validation';
import { authService } from '../services/authService';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [devTokenData, setDevTokenData] = useState(null);

  const handleChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    if (touched) {
      setError(validateEmail(val));
    }
  };

  const handleBlur = (e) => {
    setTouched(true);
    setError(validateEmail(e.target.value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);
    setDevTokenData(null);

    const emailErr = validateEmail(email);
    setError(emailErr);
    setTouched(true);

    if (emailErr) return;

    setIsSubmitting(true);
    try {
      const response = await authService.forgotPassword({ email });

      // Check if backend returned devToken (development mode)
      if (response?.devToken) {
        setDevTokenData({
          token: response.devToken,
          note: response.devNote || 'Development mode reset token provided by server.',
        });
      }

      setStatusMessage({
        type: 'info',
        text: response.message || 'If that email address is registered, a password reset link has been sent.',
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Unable to process password reset request. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="Enter your registered email to request a secure password reset"
    >
      {statusMessage && (
        <AlertMessage
          type={statusMessage.type}
          message={statusMessage.text}
          onDismiss={() => setStatusMessage(null)}
        />
      )}

      {devTokenData && (
        <div className="dev-token-banner">
          <div className="dev-token-badge">Development Token Generated</div>
          <p className="dev-token-note">{devTokenData.note}</p>
          <div className="dev-token-display">
            <code>{devTokenData.token}</code>
          </div>
          <button
            type="button"
            className="btn-submit"
            onClick={() => navigate(`/reset-password?token=${encodeURIComponent(devTokenData.token)}`)}
          >
            Continue to Reset Password with this Token →
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="auth-form">
        <FormInput
          id="email"
          label="Account Email"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={handleChange}
          onBlur={handleBlur}
          error={error}
          helperText="We will check our system for this account to initiate password recovery"
          required
          disabled={isSubmitting}
          autoComplete="email"
        />

        <button
          type="submit"
          className="btn-submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Requesting Reset...' : 'Request Password Reset'}
        </button>

        <div className="reset-token-helper-card">
          <span>Already received a reset token? </span>
          <Link to="/reset-password" className="text-link font-medium">
            Enter reset token here
          </Link>
        </div>

        <div className="form-footer-action">
          <Link to="/login" className="text-link back-link">
            ← Back to Sign In
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
