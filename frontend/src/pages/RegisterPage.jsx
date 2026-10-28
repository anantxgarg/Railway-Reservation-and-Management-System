import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import FormInput from '../components/FormInput';
import AlertMessage from '../components/AlertMessage';
import {
  validateName,
  validateEmail,
  validatePhone,
  validatePassword,
  validateConfirmPassword,
} from '../utils/validation';
import { authService } from '../services/authService';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationSuccessData, setRegistrationSuccessData] = useState(null);

  const runFieldValidation = (name, value, allValues = formData) => {
    switch (name) {
      case 'name':
        return validateName(value);
      case 'email':
        return validateEmail(value);
      case 'phone':
        return validatePhone(value);
      case 'password':
        return validatePassword(value);
      case 'confirmPassword':
        return validateConfirmPassword(allValues.password, value);
      default:
        return '';
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedValues = { ...formData, [name]: value };
    setFormData(updatedValues);

    if (touched[name]) {
      const error = runFieldValidation(name, value, updatedValues);
      setErrors((prev) => ({ ...prev, [name]: error }));
    }

    if (name === 'password' && touched.confirmPassword) {
      const confirmErr = validateConfirmPassword(value, formData.confirmPassword);
      setErrors((prev) => ({ ...prev, confirmPassword: confirmErr }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = runFieldValidation(name, value, formData);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage(null);
    setRegistrationSuccessData(null);

    const nameErr = validateName(formData.name);
    const emailErr = validateEmail(formData.email);
    const phoneErr = validatePhone(formData.phone);
    const passwordErr = validatePassword(formData.password);
    const confirmErr = validateConfirmPassword(formData.password, formData.confirmPassword);

    const newErrors = {
      name: nameErr,
      email: emailErr,
      phone: phoneErr,
      password: passwordErr,
      confirmPassword: confirmErr,
    };

    setErrors(newErrors);
    setTouched({
      name: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
    });

    if (nameErr || emailErr || phoneErr || passwordErr || confirmErr) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authService.register({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
      });

      setRegistrationSuccessData(response);
      setStatusMessage({
        type: 'success',
        text: response.message || 'Account created successfully! You can now sign in with your email and password.',
      });

      // Clear sensitive form fields
      setFormData({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
      });
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
        text: err.message || 'Registration failed. Please check the information provided.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Register as a customer to book and manage railway journeys"
      badgeText="Customer Portal"
    >
      {statusMessage && (
        <AlertMessage
          type={statusMessage.type}
          message={statusMessage.text}
          onDismiss={() => setStatusMessage(null)}
        />
      )}

      {registrationSuccessData ? (
        <div className="auth-success-card">
          <div className="status-label">Registration Successful</div>
          <div className="status-value">Customer Account Created</div>
          <p className="status-desc">
            Account for <strong>{registrationSuccessData.user?.name}</strong> (<code>{registrationSuccessData.user?.email}</code>) has been registered with status <strong>{registrationSuccessData.user?.status || 'ACTIVE'}</strong>.
          </p>
          <div className="success-action-row">
            <Link to="/login" className="btn-submit text-center-link">
              Proceed to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="auth-form">
          <FormInput
            id="name"
            label="Full Name"
            type="text"
            placeholder="e.g. Priya Sharma"
            value={formData.name}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.name}
            required
            disabled={isSubmitting}
            autoComplete="name"
          />

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

          <FormInput
            id="phone"
            label="Phone Number"
            type="tel"
            placeholder="+919876543210 (optional)"
            value={formData.phone}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.phone}
            helperText="10–15 digits with optional country code (+)"
            disabled={isSubmitting}
            autoComplete="tel"
          />

          <FormInput
            id="password"
            label="Password"
            type="password"
            placeholder="At least 8 characters"
            value={formData.password}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.password}
            helperText="Must include uppercase, lowercase, number, and special character"
            required
            disabled={isSubmitting}
            autoComplete="new-password"
          />

          <FormInput
            id="confirmPassword"
            label="Confirm Password"
            type="password"
            placeholder="Re-enter your password"
            value={formData.confirmPassword}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.confirmPassword}
            required
            disabled={isSubmitting}
            autoComplete="new-password"
          />

          <div className="account-type-banner">
            <span className="account-type-tag">Customer Account</span>
            <span className="account-type-desc">
              Staff and administrative credentials are assigned separately by the system administrator.
            </span>
          </div>

          <button
            type="submit"
            className="btn-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating Account...' : 'Register Account'}
          </button>

          <div className="form-footer-action">
            <span>Already have an account? </span>
            <Link to="/login" className="text-link font-medium">
              Sign in
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
