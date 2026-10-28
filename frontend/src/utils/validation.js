/**
 * Validation rules aligned with Backend API contract (docs/API.md)
 */

export function validateEmail(email) {
  if (!email || !email.trim()) {
    return 'Email is required';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return 'Please enter a valid email address';
  }
  return '';
}

export function validatePassword(password, fieldName = 'Password') {
  if (!password) {
    return `${fieldName} is required`;
  }
  if (password.length < 8) {
    return `${fieldName} must be at least 8 characters`;
  }
  if (!/[A-Z]/.test(password)) {
    return `${fieldName} must contain at least one uppercase letter`;
  }
  if (!/[a-z]/.test(password)) {
    return `${fieldName} must contain at least one lowercase letter`;
  }
  if (!/[0-9]/.test(password)) {
    return `${fieldName} must contain at least one number`;
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return `${fieldName} must contain at least one special character`;
  }
  return '';
}

export function validateName(name) {
  if (!name || !name.trim()) {
    return 'Full name is required';
  }
  const trimmed = name.trim();
  if (trimmed.length > 100) {
    return 'Name must not exceed 100 characters';
  }
  return '';
}

export function validatePhone(phone) {
  if (!phone || !phone.trim()) {
    return ''; // Optional field
  }
  const phoneRegex = /^\+?[0-9]{10,15}$/;
  if (!phoneRegex.test(phone.trim())) {
    return 'Phone number must be 10–15 digits (optional leading +)';
  }
  return '';
}

export function validateConfirmPassword(password, confirmPassword) {
  if (!confirmPassword) {
    return 'Please confirm your password';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match';
  }
  return '';
}

export function validateResetToken(token) {
  if (!token || !token.trim()) {
    return 'Reset token is required';
  }
  return '';
}
