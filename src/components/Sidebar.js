import React from 'react';

const Sidebar = ({ items, title }) => {
  return (
    <aside className="drawer-sidebar">
      <div className="drawer-header">
        <h3>{title}</h3>
      </div>
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
    </aside>
  );
};

export default Sidebar;