import React from 'react';
import SearchIcon from '@mui/icons-material/Search';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import ListAltIcon from '@mui/icons-material/ListAlt';
import ReceiptIcon from '@mui/icons-material/Receipt';
import UndoIcon from '@mui/icons-material/Undo';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import TrainIcon from '@mui/icons-material/Train';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import StarRateIcon from '@mui/icons-material/StarRate';
import NotificationBell from './features/notifications/NotificationBell';

// Team 6's bell in the header: unread count, opens the notification centre
function HeaderBell({ user, onClick }) {
  return <NotificationBell userId={String(user.userId)} onClick={onClick} className="app-icon-btn app-bell" />;
}

// The tabs of the logged-in app, in order. `path` is where the tab goes;
// `match` lists other first path segments that belong to it (e.g. /book/...
// is part of booking). `roles` limits a tab to those roles. `headerWidget`
// puts a button in the header instead of a tab.
//
// Booking: Team 3. Payments, refunds, concessions: Team 4. Account and
// admin: Team 1. Trains: Team 2. Live status, feedback, notifications: Team 6.
export const TABS = [
  { path: '/search', label: 'Book', icon: <SearchIcon />, match: ['book', ''] },
  { path: '/pnr', label: 'PNR status', icon: <ConfirmationNumberIcon /> },
  { path: '/bookings', label: 'My bookings', icon: <ListAltIcon />, roles: ['CUSTOMER'] },
  { path: '/payments', label: 'My payments', icon: <ReceiptIcon />, roles: ['CUSTOMER'] },
  { path: '/refunds', label: 'Refunds', icon: <UndoIcon /> },
  { path: '/concessions', label: 'Concessions', icon: <CardMembershipIcon />, staffIcon: <SupervisorAccountIcon /> },
  { path: '/live-status', label: 'Live status', icon: <GpsFixedIcon /> },
  { path: '/trains', label: 'Trains', icon: <TrainIcon /> },
  { path: '/feedback', label: 'Feedback', icon: <StarRateIcon />, roles: ['CUSTOMER'] },
  { path: '/account', label: 'Account', icon: <PersonIcon />, roles: ['CUSTOMER', 'STAFF'] },
  { path: '/admin', label: 'Admin', icon: <AdminPanelSettingsIcon />, roles: ['ADMIN'] },
  { path: '/notifications', label: 'Notifications', headerWidget: HeaderBell },
];
