import { Navigate, Route, Routes } from 'react-router';
import { ManagerProvider, RequireManager } from './app/session';
import Campaigns from './screens/Campaigns';
import Login from './screens/Login';
import Overview from './screens/Overview';
import Rewards from './screens/Rewards';
import Transactions from './screens/Transactions';

// v2: /merchant is the store manager's back office; cashiers use the POS app at /pos.
export default function App() {
  return (
    <ManagerProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/overview" element={<RequireManager><Overview /></RequireManager>} />
        <Route path="/campaigns" element={<RequireManager><Campaigns /></RequireManager>} />
        <Route path="/rewards" element={<RequireManager><Rewards /></RequireManager>} />
        <Route path="/transactions" element={<RequireManager><Transactions /></RequireManager>} />
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </ManagerProvider>
  );
}
