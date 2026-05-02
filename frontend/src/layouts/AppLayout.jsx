// AppLayout - phone-frame wrapper for the authenticated app. Renders the
// active page via <Outlet /> and a bottom navigation bar.

import { Outlet } from 'react-router-dom';
import BottomNav from '../components/common/BottomNav.jsx';

export default function AppLayout() {
  return (
    <div className="sp-shell">
      <div className="sp-frame">
        <Outlet />
        <BottomNav />
      </div>
    </div>
  );
}
