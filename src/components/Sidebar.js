import React from 'react';
import { useAuth } from '../context/AuthContext';
import UnifiedMessaging from './UnifiedMessaging/UnifiedMessaging';
import './Sidebar.css';

const Sidebar = ({ items = [], title, onOpenBilling }) => {
  const { user } = useAuth();

  return (
    <aside className="drawer-sidebar">
      <div className="drawer-header">
        <h3>{title}</h3>
      </div>

      {/* Original tool links */}
      <div className="drawer-content">
        {items.map((item, index) => (
          <a
            key={index}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`drawer-item tool-${item.color}`}
            title={item.desc}
          >
            {item.name}
          </a>
        ))}
      </div>

      {/* Messaging — always visible when logged in, no toggle */}
      {user && (
        <div className="drawer-unified-messaging">
          <UnifiedMessaging onOpenBilling={onOpenBilling} />
        </div>
      )}
    </aside>
  );
};

export default Sidebar;