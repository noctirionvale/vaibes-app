import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './SubjectDropdown.css';

// Unified subject picker — used by Studio Quiz, Subject Quiz and Anagram
// (CreativeEditor) plus the Community Room creator, so every subject
// picker in the app looks and behaves the same way.

const MENU_MIN_WIDTH = 220;  // px — floor; grows to match a wider trigger
const MENU_MAX_HEIGHT = 320; // px — hard cap; also clamped to the room left below the trigger
const MENU_GAP = 6;          // px — space between trigger and menu
const VIEWPORT_MARGIN = 8;   // px — min space kept from any viewport edge

const SubjectDropdown = ({ value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: MENU_MIN_WIDTH, maxHeight: MENU_MAX_HEIGHT });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onScroll = (e) => {
      // Scrolling the option list itself (to reach items further down)
      // is not an "outside" scroll and shouldn't close the menu — only
      // a scroll elsewhere (the page, a modal body, etc.) means the
      // trigger may have moved, so only that should close it.
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const toggleOpen = () => {
    if (open) { setOpen(false); return; }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(MENU_MIN_WIDTH, rect.width);
    // Always anchors below the trigger and never flips upward — that's
    // what used to let this menu climb up and cover a modal header or
    // tab row above it. If the full list doesn't fit in the space left
    // below, it scrolls internally instead of flipping direction.
    const top = rect.bottom + MENU_GAP;
    const availableBelow = window.innerHeight - top - VIEWPORT_MARGIN;
    const maxHeight = Math.max(120, Math.min(MENU_MAX_HEIGHT, availableBelow));
    setMenuPos({
      top,
      left: Math.max(VIEWPORT_MARGIN, Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN)),
      width,
      maxHeight,
    });
    setOpen(true);
  };

  return (
    <div className="subject-picker-wrap">
      <button type="button" ref={triggerRef} className="subject-picker-trigger" onClick={toggleOpen}>
        <span>{value}</span>
        <span className={`subject-picker-chevron ${open ? 'open' : ''}`}>▾</span>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="subject-picker-menu"
          role="listbox"
          style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width, maxHeight: menuPos.maxHeight }}
        >
          {options.map(s => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={s === value}
              className={`subject-picker-option ${s === value ? 'active' : ''}`}
              onClick={() => { onChange(s); setOpen(false); }}
            >
              {s}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default SubjectDropdown;