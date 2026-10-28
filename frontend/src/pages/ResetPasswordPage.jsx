import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import FormInput from '../components/FormInput';
import AlertMessage from '../components/AlertMessage';
import {
  validateResetToken,
  validatePassword,
  validateConfirmPassword,
} from '../utils/validation';
import { authService } from '../services/authService';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  const [formData, setFormData] = useState({
    token: tokenFromUrl,
    newPassword: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const runFieldValidation = (name, value, allValues = formData) => {
    switch (name) {
      case 'token':
        return validateResetToken(value);
      case 'newPassword':
        return validatePassword(value, 'New password');
      case 'confirmPassword':
        return validateConfirmPassword(allValues.newPassword, value);
      default:
        return '';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };
    setFormData(updated);

    if (touched[name]) {
      const err = runFieldValidation(name, value, updated);
      setErrors((prev) => ({ ...prev, [name]: err }));
    }

    if (name === 'newPassword' && touched.confirmPassword) {
      const confirmErr = validateConfirmPassword(value, formData.confirmPassword);
      setErrors((prev) => ({ ...prev, confirmPassword: confirmErr }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const err = runFieldValidation(name, value, formData);
    setErrors((prev) => ({ ...prev, [name]: err }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);
    setResetSuccess(false);

    const tokenErr = validateResetToken(formData.token);
    const passErr = validatePassword(formData.newPassword, 'New password');
    const confirmErr = validateConfirmPassword(formData.newPassword, formData.confirmPassword);

    const newErrors = {
      token: tokenErr,
      newPassword: passErr,
      confirmPassword: confirmErr,
    };

    setErrors(newErrors);
    setTouched({
      token: true,
      newPassword: true,
      confirmPassword: true,
    });

    if (tokenErr || passErr || confirmErr) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authService.resetPassword({
        token: formData.token,
        newPassword: formData.newPassword,
      });

      setResetSuccess(true);
      setStatusMessage({
        type: 'success',
        text: response.message || 'Password reset successfully. Please log in with your new password.',
      });

      // Clear password fields
      setFormData((prev) => ({
        ...prev,
        newPassword: '',
        confirmPassword: '',
      }));
      setTouched({});
      setErrors({});
    } catch (err) {
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
        text: err.message || 'Password reset failed. The token may be invalid, expired, or already used.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your verification token and specify a new secure password"
    >
      {statusMessage && (
        <AlertMessage
          type={statusMessage.type}
          message={statusMessage.text}
          onDismiss={() => setStatusMessage(null)}
        />
      )}

      {resetSuccess ? (
        <div className="auth-success-card">
          <div className="status-label">Security Update Complete</div>
          <div className="status-value">Password Successfully Changed</div>
          <p className="status-desc">
            Your account credentials have been updated. All previous sessions have been invalidated as a security precaution.
          </p>
          <div className="success-action-row">
            <Link to="/login" className="btn-submit text-center-link">
              Sign In with New Password
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="auth-form">
          <FormInput
            id="token"
            label="Reset Token"
            type="text"
            placeholder="Paste the reset token"
            value={formData.token}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.token}
            helperText="Provided via recovery link or response parameter"
            required
            disabled={isSubmitting}
          />

          <FormInput
            id="newPassword"
            label="New Password"
            type="password"
            placeholder="At least 8 characters"
            value={formData.newPassword}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.newPassword}
            helperText="Must include uppercase, lowercase, number, and special character"
            required
            disabled={isSubmitting}
            autoComplete="new-password"
          />

          <FormInput
            id="confirmPassword"
            label="Confirm New Password"
            type="password"
            placeholder="Re-enter new password"
            value={formData.confirmPassword}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.confirmPassword}
            required
            disabled={isSubmitting}
            autoComplete="new-password"
          />

          <button
            type="submit"
            className="btn-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Resetting Password...' : 'Set New Password'}
          </button>

          <div className="form-footer-action">
            <Link to="/login" className="text-link back-link">
              ← Back to Sign In
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
