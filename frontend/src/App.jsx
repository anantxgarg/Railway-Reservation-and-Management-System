import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/useAuth';
import { getRoleDestination } from './utils/roleUtils';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import AppShell from './components/AppShell';

// Team 1: accounts
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AdminLoginPage from './pages/AdminLoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import CustomerPortal from './pages/destinations/CustomerPortal';
import StaffPortal from './pages/destinations/StaffPortal';
import AdminPortal from './pages/destinations/AdminPortal';

// Team 3: booking
import SearchPage from './features/booking/SearchPage';
import PassengerForm from './features/booking/PassengerForm';
import BookingPage from './features/booking/BookingPage';
import PnrLookup from './features/booking/PnrLookup';
import MyBookings from './features/booking/MyBookings';

// Team 4: payments
import MyPayments from './components/MyPayments';
import Refunds from './components/Refunds';
import Concessions from './components/Concessions';

// Team 2: network
import TrainsPage from './features/network/TrainsPage';

// Team 6: notifications, feedback, live status
import NotificationsPage from './features/notifications/NotificationsPage';
import FeedbackPage from './features/feedback/FeedbackPage';
import LiveStatusPage from './features/livestatus/LiveStatusPage';
import { navigate } from './router';

import './App.css';

function RootRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();

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

  if (isAuthenticated && user) {
    return <Navigate to={getRoleDestination(user.role)} replace />;
  }

  return <Navigate to="/login" replace />;
}

// The booking screens take the URL's parts as a `params` array.
function Search() {
  const { user } = useAuth();
  const { from, to, date } = useParams();
  return <SearchPage params={from ? [from, to, date] : []} canBook={user.role === 'CUSTOMER'} />;
}

function Book() {
  const { runId, classCode, from, to } = useParams();
  const params = [runId, classCode, from, to];
  return <PassengerForm key={params.join('/')} params={params} />;
}

function Pnr() {
  const { user } = useAuth();
  const { pnr } = useParams();
  return pnr ? <BookingPage key={pnr} pnr={pnr} user={user} /> : <PnrLookup />;
}

function WithUser({ component: Component }) {
  const { user } = useAuth();
  return <Component user={user} />;
}

function Notifications() {
  const { user } = useAuth();
  // a "journey completed" notification opens the feedback form for that PNR
  return <NotificationsPage userId={String(user.userId)} onOpenFeedback={(pnr) => navigate(`/feedback/${pnr}`)} />;
}

function Feedback() {
  const { user } = useAuth();
  const { pnr = '' } = useParams();
  return <FeedbackPage key={pnr} userId={String(user.userId)} pnr={pnr} />;
}

function LiveStatus() {
  const { pnr = '' } = useParams();
  return <LiveStatusPage key={pnr} startPnr={pnr} />;
}

function Account() {
  const { user } = useAuth();
  return user.role === 'STAFF' ? <StaffPortal /> : <CustomerPortal />;
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public: Team 1's account pages */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />

            {/* Logged in: every team's screens inside one layout */}
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/search" element={<Search />} />
              <Route path="/search/:from/:to/:date" element={<Search />} />
              <Route
                path="/book/:runId/:classCode/:from/:to"
                element={<ProtectedRoute allowedRoles={['CUSTOMER']}><Book /></ProtectedRoute>}
              />
              <Route path="/pnr" element={<Pnr />} />
              <Route path="/pnr/:pnr" element={<Pnr />} />
              <Route
                path="/bookings"
                element={<ProtectedRoute allowedRoles={['CUSTOMER']}><MyBookings /></ProtectedRoute>}
              />
              <Route
                path="/payments"
                element={<ProtectedRoute allowedRoles={['CUSTOMER']}><WithUser component={MyPayments} /></ProtectedRoute>}
              />
              <Route path="/refunds" element={<WithUser component={Refunds} />} />
              <Route path="/concessions" element={<WithUser component={Concessions} />} />

              <Route path="/trains" element={<WithUser component={TrainsPage} />} />
              <Route path="/live-status" element={<LiveStatus />} />
              <Route path="/live-status/:pnr" element={<LiveStatus />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/feedback" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><Feedback /></ProtectedRoute>} />
              <Route path="/feedback/:pnr" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><Feedback /></ProtectedRoute>} />

              <Route
                path="/account"
                element={<ProtectedRoute allowedRoles={['CUSTOMER', 'STAFF']}><Account /></ProtectedRoute>}
              />
              <Route path="/admin" element={<AdminRoute><AdminPortal /></AdminRoute>} />

              {/* Old portal addresses from Team 1's first version */}
              <Route path="/customer" element={<Navigate to="/search" replace />} />
              <Route path="/staff" element={<Navigate to="/search" replace />} />
            </Route>

            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
