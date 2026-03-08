import { useState, useEffect } from 'react';

const Sidebar = ({ isRight = false, items }) => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sidebarStyles = {
    position: isMobile ? 'relative' : 'sticky',
    top: 0,
    height: isMobile ? 'auto' : '100vh',
    background: 'linear-gradient(180deg, rgba(20, 20, 30, 0.95) 0%, rgba(15, 15, 25, 0.9) 100%)',
    backdropFilter: 'blur(12px)',
    borderRight: isRight ? 'none' : isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
    borderLeft: isRight ? (isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.1)') : 'none',
    borderBottom: isMobile ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
    borderTop: isMobile && isRight ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
    display: 'flex',
    flexDirection: isMobile ? 'row' : 'column',
    alignItems: 'center',
    
    // CHANGED BACK TO CENTER: This puts the cards in the middle vertically
    justifyContent: isMobile ? 'space-around' : 'center', 
    
    gap: '1.5rem',
    padding: isMobile ? '1rem 0.5rem' : '2rem 1.5rem',
    overflowX: isMobile ? 'auto' : 'visible',
    overflowY: 'auto',
    
    // ADJUSTED WIDTH: Gives the cards a bit more room so they aren't squished
    width: isMobile ? '100%' : '280px', 
    
    // PREVENTS SQUISHING: Forces the sidebar to stay 280px wide even if the center is huge
    flexShrink: 0, 
    
    boxSizing: 'border-box',
    zIndex: 10
  };

  return (
    <aside className="sidebar-label" style={sidebarStyles}>
      {items.map((tool, index) => (
        <a 
          key={index} 
          href={tool.url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className={`tool-card tool-${tool.color}`}
          style={{ 
            width: '100%', 
            textDecoration: 'none', 
            textAlign: 'left' // Overriding your old center text alignment for readability
          }}
        >
          {/* We ensure the text formatting looks good inside the new cards */}
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#fff', textTransform: 'none', letterSpacing: 'normal' }}>
            {tool.name}
          </h4>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', textTransform: 'none', letterSpacing: 'normal', fontWeight: 'normal' }}>
            {tool.desc}
          </p>
        </a>
      ))}
    </aside>
  );
};

export default Sidebar;