import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import LoginPage          from './pages/LoginPage';
import RegisterPage       from './pages/RegisterPage';
import DashboardPage      from './pages/DashboardPage';
import CreateEventPage    from './pages/CreateEventPage';
import EditEventPage      from './pages/EditEventPage';
import EventListPage      from './pages/EventListPage';
import EventDetailPage    from './pages/EventDetailPage';
import MapViewPage        from './pages/MapViewPage';
import BookEventPage      from './pages/BookEventPage';
import MyBookingsPage     from './pages/MyBookingsPage';
import EventBookingsPage  from './pages/EventBookingsPage';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <span className="text-stone-400 animate-pulse-soft font-body">Loading…</span>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
};

const GuestRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return !user ? children : <Navigate to="/dashboard" replace />;
};

const RoleRoute = ({ role, children }) => {
  const { user } = useAuth();
  return user?.role === role ? children : <Navigate to="/dashboard" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/"         element={<Navigate to="/dashboard" replace />} />
          <Route path="/login"    element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

          {/* Any authenticated user */}
          <Route path="/dashboard"    element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/events"       element={<ProtectedRoute><EventListPage /></ProtectedRoute>} />
          <Route path="/events/:id"   element={<ProtectedRoute><EventDetailPage /></ProtectedRoute>} />
          <Route path="/map"          element={<ProtectedRoute><MapViewPage /></ProtectedRoute>} />

          {/* NGO-only */}
          <Route path="/events/:id/book" element={
            <ProtectedRoute><RoleRoute role="NGO"><BookEventPage /></RoleRoute></ProtectedRoute>
          } />
          <Route path="/bookings" element={
            <ProtectedRoute><RoleRoute role="NGO"><MyBookingsPage /></RoleRoute></ProtectedRoute>
          } />

          {/* Organizer-only */}
          <Route path="/events/new" element={
            <ProtectedRoute><RoleRoute role="ORGANIZER"><CreateEventPage /></RoleRoute></ProtectedRoute>
          } />
          <Route path="/events/:id/edit" element={
            <ProtectedRoute><RoleRoute role="ORGANIZER"><EditEventPage /></RoleRoute></ProtectedRoute>
          } />
          <Route path="/events/:id/bookings" element={
            <ProtectedRoute><RoleRoute role="ORGANIZER"><EventBookingsPage /></RoleRoute></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
