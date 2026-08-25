import React from 'react';
import './LampToggle.css';

const LampToggle = ({ isDark, onClick, size = 32, className = '' }) => {
  const isOn = !isDark; // lamp ON = light mode

  return (
    <button
      className={`lamp-toggle-btn ${isOn ? 'lamp-on' : 'lamp-off'} ${className}`}
      onClick={onClick}
      aria-label={isOn ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isOn ? 'Dark mode' : 'Light mode'}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 40 40" className="lamp-svg" aria-hidden="true">
        {/* Base */}
        <rect className="lamp-base" x="16" y="34" width="8" height="4" rx="1" />
        
        {/* Stem */}
        <rect className="lamp-stem" x="19" y="24" width="2" height="10" rx="1" />
        
        {/* Bending arm - curved path */}
        <path className="lamp-arm" d="M20 24 Q12 20 10 14" />
        
        {/* Shade */}
        <ellipse className="lamp-shade" cx="10" cy="14" rx="5" ry="3" />
        
        {/* Bulb */}
        <circle className="lamp-bulb" cx="10" cy="14" r="2.5" />
        
        {/* Glow halo - only visible when ON */}
        <circle className="lamp-halo" cx="10" cy="14" r="6" />
        
        {/* Light beam cone - only visible when ON */}
        <path className="lamp-beam" d="M7 16 L5 24 L15 24 Z" />
      </svg>
      <span className="lamp-label">{isOn ? 'Light' : 'Dark'}</span>
    </button>
  );
};

export default LampToggle;