import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AdminLayout } from './pages/AdminLayout.js';
import { AdminLoginPage } from './pages/AdminLoginPage.js';
import { AdminDomainsPage } from './pages/AdminDomainsPage.js';
import { AdminUsersPage } from './pages/AdminUsersPage.js';
import { AdminWorkshopDetailPage } from './pages/AdminWorkshopDetailPage.js';
import { AdminWorkshopQueuePage } from './pages/AdminWorkshopQueuePage.js';
import { HomePage } from './pages/HomePage.js';
import { RequesterAccessPage } from './pages/RequesterAccessPage.js';
import { RequestSuccessPage } from './pages/RequestSuccessPage.js';
import { WorkshopRequestPage } from './pages/WorkshopRequestPage.js';
import { WorkshopTrackingPage } from './pages/WorkshopTrackingPage.js';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/request/auth" element={<RequesterAccessPage />} />
        <Route path="/request/new" element={<WorkshopRequestPage />} />
        <Route path="/request/success" element={<RequestSuccessPage />} />
        <Route path="/workshops/:trackingToken" element={<WorkshopTrackingPage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="workshops" replace />} />
          <Route path="workshops" element={<AdminWorkshopQueuePage />} />
          <Route path="workshops/:id" element={<AdminWorkshopDetailPage />} />
          <Route path="domains" element={<AdminDomainsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
