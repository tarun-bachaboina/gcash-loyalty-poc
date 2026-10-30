import { Navigate, Route, Routes } from 'react-router';
import { RequireTerminal, TerminalProvider } from './app/session';
import Carts from './screens/Carts';
import Checkout from './screens/Checkout';
import Login from './screens/Login';
import Receipt from './screens/Receipt';
import Sales from './screens/Sales';

/** v2 POS (cashier): carts → checkout → receipt. Replaces the manual earn/burn terminal. */
export default function App() {
  return (
    <TerminalProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/carts" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/carts" element={<RequireTerminal><Carts /></RequireTerminal>} />
        <Route path="/checkout/:cartId" element={<RequireTerminal><Checkout /></RequireTerminal>} />
        <Route path="/receipt" element={<RequireTerminal><Receipt /></RequireTerminal>} />
        <Route path="/sales" element={<RequireTerminal><Sales /></RequireTerminal>} />
        <Route path="*" element={<Navigate to="/carts" replace />} />
      </Routes>
    </TerminalProvider>
  );
}
