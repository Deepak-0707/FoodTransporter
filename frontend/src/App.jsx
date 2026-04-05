// src/App.jsx — Phase 4
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider }         from './context/SocketContext';
import { NotificationProvider }   from './context/NotificationContext';

import LoginPage           from './pages/LoginPage';
import RegisterPage        from './pages/RegisterPage';
import DashboardPage       from './pages/DashboardPage';
import CreateEventPage     from './pages/CreateEventPage';
import EditEventPage       from './pages/EditEventPage';
import EventListPage       from './pages/EventListPage';
import EventDetailPage     from './pages/EventDetailPage';
import EventDetails        from './pages/EventDetails';
import MapViewPage         from './pages/MapViewPage';
import RequestFoodPage     from './pages/RequestFoodPage';
import MyRequestsPage      from './pages/MyRequestsPage';
import EventRequestsPage   from './pages/EventRequestsPage';
import OrganizerDashboard  from './pages/OrganizerDashboard';
import NGODashboard        from './pages/NGODashboard';

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

// Smart dashboard redirect based on role
const SmartDashboard = () => {
  const { user } = useAuth();
  if (user?.role === 'ORGANIZER') return <OrganizerDashboard />;
  if (user?.role === 'NGO')       return <NGODashboard />;
  return <DashboardPage />;
};

function AppRoutes() {
  return (
    <SocketProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/"         element={<Navigate to="/dashboard" replace />} />
            <Route path="/login"    element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

            {/* Any authenticated */}
            <Route path="/dashboard"  element={<ProtectedRoute><SmartDashboard /></ProtectedRoute>} />
            <Route path="/events"     element={<ProtectedRoute><EventListPage /></ProtectedRoute>} />
            <Route path="/map"        element={<ProtectedRoute><MapViewPage /></ProtectedRoute>} />

            {/* Organizer-only — /events/new MUST come before /events/:id */}
            <Route path="/events/new" element={
              <ProtectedRoute><RoleRoute role="ORGANIZER"><CreateEventPage /></RoleRoute></ProtectedRoute>
            } />

            {/* Parameterised event routes */}
            <Route path="/events/:id" element={<ProtectedRoute><EventDetails /></ProtectedRoute>} />

            {/* NGO-only */}
            <Route path="/events/:id/request" element={
              <ProtectedRoute><RoleRoute role="NGO"><RequestFoodPage /></RoleRoute></ProtectedRoute>
            } />
            <Route path="/requests" element={
              <ProtectedRoute><RoleRoute role="NGO"><MyRequestsPage /></RoleRoute></ProtectedRoute>
            } />
            <Route path="/events/:id/edit" element={
              <ProtectedRoute><RoleRoute role="ORGANIZER"><EditEventPage /></RoleRoute></ProtectedRoute>
            } />
            <Route path="/events/:id/requests" element={
              <ProtectedRoute><RoleRoute role="ORGANIZER"><EventRequestsPage /></RoleRoute></ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </NotificationProvider>
    </SocketProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
