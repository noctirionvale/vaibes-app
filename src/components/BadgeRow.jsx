import React from 'react';
import { BADGE_DEFS, resolveBadgeType } from '../lib/badgeDefs';
import './BadgeRow.css';

const BadgeRow = ({ badges = [], size = 'sm', max = 4, onClick }) => {
  if (!badges.length) return null;
  
  // ✅ FIXED: Pass badge_key first, then badge_type as fallback
  const types = [...new Set(badges.map(b => resolveBadgeType(b.badge_key, b.badge_type)))];
  
  const shown = types.slice(0, max);
  const overflow = types.length - shown.length;

  return (
    <span
      className={`badge-row badge-row-${size}${onClick ? ' badge-row-clickable' : ''}`}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
    >
      {shown.map(type => {
        const def = BADGE_DEFS[type];
        if (!def) return null;
        return (
          <span key={type} className="badge-chip" title={`${def.label} — ${def.desc}`} style={{ '--badge-color': def.color }}>
            {def.icon}
          </span>
        );
      })}
      {overflow > 0 && <span className="badge-chip badge-chip-more">+{overflow}</span>}
    </span>
  );
};

export default BadgeRow;