import { useState } from 'react';
import { Alert, Box, Button, IconButton, InputAdornment, TextField } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { GlassSection } from './ui';
import { validatePassword, validateConfirmPassword } from '../utils/validation';
import { authService } from '../services/authService';
import { useAuth } from '../context/useAuth';

/**
 * Password field with a show/hide toggle, used by the change-password form.
 * Errors come in as a string and are shown under the field.
 */
function PasswordField({ id, label, error, helperText, ...rest }) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      id={id}
      name={id}
      label={label}
      type={visible ? 'text' : 'password'}
      error={Boolean(error)}
      helperText={error || helperText}
      fullWidth
      required
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                edge="end"
                aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
                onClick={() => setVisible((prev) => !prev)}
                onMouseDown={(e) => e.preventDefault()}
              >
                {visible ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
      {...rest}
    />
  );
}

/**
 * Collapsible "change your password" section of the account pages. Validates
 * the three fields on blur/submit, calls authService.changePassword and shows
 * the result as an alert.
 */
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
    <GlassSection
      title="Security & Password Management"
      subtitle="Update your account password within the authenticated session"
      icon={<LockOutlinedIcon />}
      actions={(
        <Button
          variant="outlined"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
        >
          {isOpen ? 'Close Security Settings' : 'Change Password'}
        </Button>
      )}
      sx={isOpen ? undefined : { pb: 2.75 }}
      contentSx={isOpen ? { pt: 2.5 } : { display: 'none' }}
    >
      {isOpen && (
        <Box>
          {statusMessage && (
            <Alert severity={statusMessage.type} onClose={() => setStatusMessage(null)} sx={{ mb: 2.5 }}>
              {statusMessage.text}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit}
            noValidate
            sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 480 }}
          >
            <PasswordField
              id="currentPassword"
              label="Current Password"
              placeholder="Enter current password"
              value={formData.currentPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.currentPassword}
              disabled={isSubmitting}
              autoComplete="current-password"
            />

            <PasswordField
              id="newPassword"
              label="New Password"
              placeholder="At least 8 characters"
              value={formData.newPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.newPassword}
              helperText="Must contain uppercase, lowercase, digit, and special character"
              disabled={isSubmitting}
              autoComplete="new-password"
            />

            <PasswordField
              id="confirmPassword"
              label="Confirm New Password"
              placeholder="Re-enter new password"
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.confirmPassword}
              disabled={isSubmitting}
              autoComplete="new-password"
            />

            <Box>
              <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
                {isSubmitting ? 'Updating Password...' : 'Update Password'}
              </Button>
            </Box>
          </Box>
        </Box>
      )}
    </GlassSection>
  );
}
