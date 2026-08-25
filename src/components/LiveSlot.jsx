import React from 'react';
import useSyncedRect from '../hooks/useSyncedRect';

// Renders `children` once, position:fixed exactly over whichever placeholder
// ref (slotRef) is currently active. Lets a stateful component (VidFeed,
// EduFeed, ...) survive being "moved" between the center column and the
// right PanelSwitcher without ever unmounting.
const LiveSlot = ({ slotRef, hostClassName, children }) => {
  const rect = useSyncedRect(slotRef, true);
  return (
    <div
      className={hostClassName}
      style={{
        position: 'fixed',
        top: rect ? rect.top : -9999,
        left: rect ? rect.left : -9999,
        width: rect ? rect.width : 0,
        height: rect ? rect.height : 0,
        zIndex: 20,
      }}
    >
      {children}
    </div>
  );
};

export default LiveSlot;