import { useEffect, useState } from "react";
import type { FC } from "react";
import { useApp } from "../../contexts/AppContext";

interface SidePanelProps {
	side: "left" | "right";
	children: React.ReactNode;
	isMobile: boolean;
}

const SidePanel: FC<SidePanelProps> = ({ side, children, isMobile }) => {
	const {
		leftPanelExpanded,
		rightPanelExpanded,
		setLeftPanelExpanded,
		setRightPanelExpanded,
	} = useApp();

	// Use local state to track panel state, initialized from context
	const [isLocalExpanded, setIsLocalExpanded] = useState(
		side === "left" ? leftPanelExpanded : rightPanelExpanded,
	);

	// Update local state when context state changes
	useEffect(() => {
		setIsLocalExpanded(
			side === "left" ? leftPanelExpanded : rightPanelExpanded,
		);
	}, [side, leftPanelExpanded, rightPanelExpanded]);

	// Reset panel state when switching between mobile and desktop modes
	useEffect(() => {
		if (isMobile) {
			// Ensure panels are collapsed in mobile mode
			setIsLocalExpanded(false);
			if (side === "left") {
				setLeftPanelExpanded(false);
			} else {
				setRightPanelExpanded(false);
			}
		} else {
			// Expand panels in desktop mode
			setIsLocalExpanded(true);
			if (side === "left") {
				setLeftPanelExpanded(true);
			} else {
				setRightPanelExpanded(true);
			}
		}
	}, [isMobile, side, setLeftPanelExpanded, setRightPanelExpanded]);

	// Apply mobile-specific class when in mobile mode
	const mobileClass = isMobile ? "mobile" : "";

	// Toggle panel state and update both local state and context
	const togglePanel = () => {
		const newState = !isLocalExpanded;
		setIsLocalExpanded(newState);

		// Also update the context state
		if (side === "left") {
			setLeftPanelExpanded(newState);
		} else {
			setRightPanelExpanded(newState);
		}
	};

	return (
		<div
			className={`side-panel ${side}-panel ${isLocalExpanded ? "expanded" : "collapsed"} ${mobileClass}`}
		>
			<button
				type="button"
				className={`collapse-button vertical ${side}`}
				onClick={togglePanel}
			>
				{(side === "left") !== isLocalExpanded ? ">" : "<"}
			</button>
			{isLocalExpanded && <div className="pane-content">{children}</div>}
		</div>
	);
};

export default SidePanel;
