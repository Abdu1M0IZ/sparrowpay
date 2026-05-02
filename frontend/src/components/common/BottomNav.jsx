// Bottom nav keeps all app routes accessible while matching the compact
// icon-first style from the ZIP reference.

import { NavLink } from 'react-router-dom';
import { Home, PlusCircle, History } from 'lucide-react';

const items = [
  { to: '/app/dashboard', label: 'Home', Icon: Home },
  { to: '/app/create', label: 'Create', Icon: PlusCircle },
  { to: '/app/history', label: 'History', Icon: History },
];

export default function BottomNav() {
  return (
    <nav className="sp-bottom-nav" aria-label="Primary">
      {items.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => (isActive ? 'active' : '')}
          style={{ textDecoration: 'none' }}
        >
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
