import { Navigate, Route, Routes } from 'react-router';
import Audit from './screens/Audit';
import Dashboard from './screens/Dashboard';
import Rewards from './screens/Rewards';
import Approvals from './screens/Approvals';

// No login for the admin console (CLAUDE.md decision 11)
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/approvals" element={<Approvals />} />
      <Route path="/rewards" element={<Rewards />} />
      <Route path="/audit" element={<Audit />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
