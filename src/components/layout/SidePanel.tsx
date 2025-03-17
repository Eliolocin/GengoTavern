import type React from 'react';

interface SidePanelProps {
  side: 'left' | 'right';
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  children: React.ReactNode;
}

const SidePanel: React.FC<SidePanelProps> = ({
  side,
  isCollapsed,
  setIsCollapsed,
  children
}) => {
  return (
    <div className={`side-panel ${side}-panel ${isCollapsed ? 'collapsed' : 'expanded'}`}>
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
