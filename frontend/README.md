# Safar — Railway Reservation Frontend (Team 1)

Frontend client for the Railway Reservation & Management System, featuring a modern responsive UI, dark/light theme switching, role-based access control, and complete integration with the Team 1 Identity & Access authentication backend.

---

## Features

- **Branding**: Safar (*“Let every journey take you somewhere wonderful.”*)
- **Authentication Flows**:
  - Customer Registration (`/register`) with client-side & server-side validation
  - Customer / Staff / Admin Login (`/login`)
  - Session Persistence via `localStorage` (AccessToken + RefreshToken)
  - Token Refresh lifecycle & automatic session expiration handling
  - Self-service Password Reset via Brevo transactional email (`/forgot-password` & `/reset-password`)
  - In-session Change Password
- **Role-Based Access Control (RBAC)**:
  - Route guarding via `ProtectedRoute`
  - Customer Portal (`/customer`)
  - Staff Operations Portal (`/staff`)
  - Administrator Portal (`/admin`)
  - 403 Security Enforcement Page (`/unauthorized`)
- **Visuals & Themes**:
  - Dual Theme support (Dark & Light modes) with persistent user preference
  - Fixed full-viewport themed backgrounds
  - Modern typography and accessible UI components

---

## Getting Started

### Prerequisites

- **Node.js**: `v18.0.0` or higher (`v20+` recommended)
- **Backend API**: Running at `http://localhost:3000` (see `backend/README.md` or root `README.md`)

### Installation

```bash
cd frontend
npm install
```

### Environment Configuration

The frontend works out of the box with the default Vite proxy. Optionally, copy the example environment file:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | API base endpoint | `/api` (proxied to `http://localhost:3000` by Vite) |

### Development Server

Start Vite in development mode:

```bash
npm run dev
```

The application will be accessible at:
- `http://localhost:5173` (or `http://localhost:5174` if port 5173 is occupied)

### Production Build

Build and bundle optimized static assets:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

### Code Linting

```bash
npm run lint
```

---

## Project Structure

```
frontend/
├── public/              # Static assets, backgrounds, icons, and videos
├── src/
│   ├── assets/          # Component images and illustrations
│   ├── components/      # Reusable UI components (AuthLayout, FormInput, ProtectedRoute, AlertMessage)
│   ├── context/         # AuthContext and ThemeContext state providers
│   ├── pages/           # Auth pages (Login, Register, ForgotPassword, ResetPassword, Unauthorized)
│   │   └── destinations/# Role-specific portals (CustomerPortal, StaffPortal, AdminPortal)
│   ├── services/        # API client and authService wrapper
│   ├── utils/           # Validation, role RBAC utilities, token storage helpers
│   ├── App.css          # Core design system and theme styles
│   ├── App.jsx          # Route definitions and role access mappings
│   ├── index.css        # Global CSS resets and font imports
│   └── main.jsx         # React application entry point
├── package.json
└── vite.config.js       # Vite dev server configuration and API reverse-proxy
```
