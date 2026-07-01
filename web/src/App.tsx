import { Navigate, Route, Routes } from 'react-router-dom';
import { ToolApp } from './tool/ToolApp';
import { AdminLogin } from './admin/AdminLogin';
import { AdminShell } from './admin/AdminShell';
import { AdminDashboard } from './admin/AdminDashboard';
import { AdminLocations } from './admin/AdminLocations';
import { AdminUsageLog } from './admin/AdminUsageLog';
import { AdminPnl } from './admin/AdminPnl';
import { AdminFeedback } from './admin/AdminFeedback';
import { AdminTickets } from './admin/AdminTickets';
import { AdminSettings } from './admin/AdminSettings';

export function App() {
  return (
    <Routes>
      {/* GHL-embedded tool (FRD §7.1–7.6) */}
      <Route path="/" element={<ToolApp screen="workspace" />} />
      <Route path="/history" element={<ToolApp screen="history" />} />

      {/* Admin oversight (FRD §7.7) */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminShell />}>
        <Route index element={<AdminDashboard />} />
        <Route path="locations" element={<AdminLocations />} />
        <Route path="usage" element={<AdminUsageLog />} />
        <Route path="pnl" element={<AdminPnl />} />
        <Route path="feedback" element={<AdminFeedback />} />
        <Route path="tickets" element={<AdminTickets />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
