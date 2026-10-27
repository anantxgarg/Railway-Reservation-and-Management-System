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

// The tabs of the logged-in app, in order. `path` is where the tab goes;
// `match` lists other first path segments that belong to it (e.g. /book/...
// is part of booking). `roles` limits a tab to those roles.
//
// Booking: Team 3. Payments, refunds, concessions: Team 4. Account and
// admin: Team 1.
export const TABS = [
  { path: '/search', label: 'Book', icon: <SearchIcon />, match: ['book', ''] },
  { path: '/pnr', label: 'PNR status', icon: <ConfirmationNumberIcon /> },
  { path: '/bookings', label: 'My bookings', icon: <ListAltIcon />, roles: ['CUSTOMER'] },
  { path: '/payments', label: 'My payments', icon: <ReceiptIcon />, roles: ['CUSTOMER'] },
  { path: '/refunds', label: 'Refunds', icon: <UndoIcon /> },
  { path: '/concessions', label: 'Concessions', icon: <CardMembershipIcon />, staffIcon: <SupervisorAccountIcon /> },
  { path: '/account', label: 'Account', icon: <PersonIcon />, roles: ['CUSTOMER', 'STAFF'] },
  { path: '/admin', label: 'Admin', icon: <AdminPanelSettingsIcon />, roles: ['ADMIN'] },
];
