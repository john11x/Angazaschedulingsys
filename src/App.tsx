import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import '@aws-amplify/ui-react/styles.css';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import RequireAuth from '@/pages/staff/RequireAuth';
import RequireCoordinator from '@/pages/coordinator/RequireCoordinator';
import CoordinatorLayout from '@/components/coordinator/CoordinatorLayout';
import CoordinatorDashboardPage from '@/pages/coordinator/CoordinatorDashboardPage';
import CoordinatorSchoolsPage from '@/pages/coordinator/CoordinatorSchoolsPage';
import CoordinatorCreateUserPage from '@/pages/coordinator/CoordinatorCreateUserPage';
import CoordinatorUsersPage from '@/pages/coordinator/CoordinatorUsersPage';
import StaffLayout from '@/components/staff/StaffLayout';
import StaffDashboardPage from '@/pages/staff/StaffDashboardPage';
import StaffBookingsPage from '@/pages/staff/StaffBookingsPage';
import StaffAvailabilityPage from '@/pages/staff/StaffAvailabilityPage';
import StaffMySchoolPage from '@/pages/staff/StaffMySchoolPage';
import StaffSchoolAvailabilityPage from '@/pages/staff/StaffSchoolAvailabilityPage';
import StaffScheduleSessionPage from '@/pages/staff/StaffScheduleSessionPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireCoordinator />}>
          <Route path="/app" element={<CoordinatorLayout />}>
            <Route index element={<CoordinatorDashboardPage />} />
            <Route path="schools" element={<CoordinatorSchoolsPage />} />
            <Route path="users" element={<CoordinatorUsersPage />} />
            <Route path="users/create" element={<CoordinatorCreateUserPage />} />
            <Route path="schedule" element={<StaffScheduleSessionPage />} />
          </Route>
        </Route>
        <Route element={<RequireAuth />}>
          <Route path="/dashboard" element={<StaffLayout />}>
            <Route index element={<StaffDashboardPage />} />
            <Route path="bookings" element={<StaffBookingsPage />} />
            <Route path="availability" element={<StaffAvailabilityPage />} />
            <Route path="school" element={<StaffMySchoolPage />} />
            <Route path="school-availability" element={<StaffSchoolAvailabilityPage />} />
            <Route path="schedule" element={<StaffScheduleSessionPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
