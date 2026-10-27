import { useState } from 'react';
import FormInput from './FormInput';
import AlertMessage from './AlertMessage';
import { validatePassword, validateConfirmPassword } from '../utils/validation';
import { authService } from '../services/authService';
import { useAuth } from '../context/useAuth';

export default function ChangePasswordCard() {
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (touched[name]) {
      let err = '';
      if (name === 'currentPassword') {
        err = !value ? 'Current password is required' : '';
      } else if (name === 'newPassword') {
        err = validatePassword(value, 'New password');
      } else if (name === 'confirmPassword') {
        err = validateConfirmPassword(formData.newPassword, value);
      }
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

    let err = '';
    if (name === 'currentPassword') {
      err = !value ? 'Current password is required' : '';
    } else if (name === 'newPassword') {
      err = validatePassword(value, 'New password');
    } else if (name === 'confirmPassword') {
      err = validateConfirmPassword(formData.newPassword, value);
    }
    setErrors((prev) => ({ ...prev, [name]: err }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);

    const currentErr = !formData.currentPassword ? 'Current password is required' : '';
    const newErr = validatePassword(formData.newPassword, 'New password');
    const confirmErr = validateConfirmPassword(formData.newPassword, formData.confirmPassword);

    setErrors({
      currentPassword: currentErr,
      newPassword: newErr,
      confirmPassword: confirmErr,
    });
    setTouched({
      currentPassword: true,
      newPassword: true,
      confirmPassword: true,
    });

    if (currentErr || newErr || confirmErr) return;

    setIsSubmitting(true);
    try {
      const res = await authService.changePassword(
        {
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        },
        token
      );

      setStatusMessage({
        type: 'success',
        text: res.message || 'Password changed successfully. All sessions have been refreshed.',
      });
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setTouched({});
      setErrors({});
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Failed to change password. Please verify your current password.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="change-password-section">
      <div className="change-password-header">
        <div className="change-password-titles">
          <h3 className="section-title">Security &amp; Password Management</h3>
          <p className="section-subtitle">
            Update your account password within the authenticated session
          </p>
        </div>
        <button
          type="button"
          className="btn-toggle-security"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
        >
          {isOpen ? 'Close Security Settings' : 'Change Password'}
        </button>
      </div>

      {isOpen && (
        <div className="change-password-card">
          {statusMessage && (
            <AlertMessage
              type={statusMessage.type}
              message={statusMessage.text}
              onDismiss={() => setStatusMessage(null)}
            />
          )}

          <form onSubmit={handleSubmit} noValidate className="auth-form">
            <FormInput
              id="currentPassword"
              label="Current Password"
              type="password"
              placeholder="Enter current password"
              value={formData.currentPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.currentPassword}
              required
              disabled={isSubmitting}
              autoComplete="current-password"
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
              helperText="Must contain uppercase, lowercase, digit, and special character"
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

            <div className="form-action-row">
              <button
                type="submit"
                className="btn-submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
