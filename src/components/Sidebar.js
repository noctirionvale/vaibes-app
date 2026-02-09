import { useState, useEffect } from 'react';

const Sidebar = ({ isRight = false, items }) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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
    justifyContent: isMobile ? 'space-around' : 'center',
    gap: isMobile ? '0.5rem' : '3rem',
    padding: isMobile ? '1rem 0.5rem' : '2rem 1rem',
    fontWeight: 800,
    fontSize: isMobile ? '0.55rem' : '0.75rem',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    textAlign: 'center',
    writingMode: 'horizontal-tb',
    overflowX: isMobile ? 'auto' : 'visible',
    overflowY: isMobile ? 'hidden' : 'auto'
  };

  const spanStyles = {
    transform: 'none',
    writingMode: 'horizontal-tb',
    padding: isMobile ? '0.25rem 0.5rem' : '0.5rem 0',
    width: isMobile ? 'auto' : '100%',
    whiteSpace: isMobile ? 'nowrap' : 'normal',
    flexShrink: isMobile ? 0 : 1,
    position: 'relative',
    zIndex: 1,
    transition: 'all 0.4s ease',
    color: isRight ? '#00e5ff' : '#00e5ff',
    textShadow: isRight 
      ? '0 0 8px rgba(106, 92, 255, 0.4), 0 0 15px rgba(255, 255, 255, 0.2)' 
      : '0 0 8px rgba(0, 229, 255, 0.5), 0 0 15px rgba(255, 255, 255, 0.2)',
    borderBottom: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
    borderRight: isMobile ? '1px solid rgba(255, 255, 255, 0.05)' : 'none'
  };

  return (
    <aside className="sidebar-label" style={sidebarStyles}>
      {items.map((item, index) => (
        <span key={index} style={spanStyles}>
          {item}
        </span>
      ))}
    </aside>
  );
};

export default Sidebar;