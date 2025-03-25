import React, { useEffect } from 'react';

interface SidePanelProps {
  side: 'left' | 'right';
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  children: React.ReactNode;
  isMobile: boolean;
}

const SidePanel: React.FC<SidePanelProps> = ({
  side,
  isCollapsed,
  setIsCollapsed,
  children,
  isMobile
}) => {
  // Reset panel state when switching between mobile and desktop modes
  useEffect(() => {
    if (isMobile) {
      // Ensure panels are collapsed in mobile mode
      setIsCollapsed(true);
    } else {
      // Expand panels in desktop mode
      setIsCollapsed(false);
    }
  }, [isMobile, setIsCollapsed]);

  // Apply mobile-specific class when in mobile mode
  const mobileClass = isMobile ? 'mobile' : '';

  return (
    <div className={`side-panel ${side}-panel ${isCollapsed ? 'collapsed' : 'expanded'} ${mobileClass}`}>
      <button
        type="button"
        className={`collapse-button vertical ${side}`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {(side === 'left') !== isCollapsed ? "<" : ">"}
      </button>
      {!isCollapsed && <div className="pane-content">{children}</div>}
    </div>
  );
};

export default SidePanel;
