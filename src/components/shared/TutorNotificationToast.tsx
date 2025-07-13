/**
 * TutorNotificationToast Component
 * Shows a brief notification when tutor feedback arrives in Visual Novel mode
 */

import { useState, useEffect } from "react";
import type { FC } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface TutorNotificationToastProps {
	isVisible: boolean;
	unreadCount: number;
	onDismiss: () => void;
	onSwitchToChat: () => void;
	autoHideDelay?: number; // Milliseconds before auto-hide
}

/**
 * TutorNotificationToast displays a brief popup notification
 * when grammar correction feedback is available in VN mode
 */
const TutorNotificationToast: FC<TutorNotificationToastProps> = ({
	isVisible,
	unreadCount,
	onDismiss,
	onSwitchToChat,
	autoHideDelay = 4000, // 4 seconds default
}) => {
	const [isVisible_, setIsVisible_] = useState(false);

	// Handle visibility with animation
	useEffect(() => {
		if (isVisible) {
			setIsVisible_(true);

			// Auto-hide after delay
			const timer = setTimeout(() => {
				setIsVisible_(false);
				setTimeout(onDismiss, 300); // Wait for fade-out animation
			}, autoHideDelay);

			return () => clearTimeout(timer);
		} else {
			setIsVisible_(false);
		}
	}, [isVisible, autoHideDelay, onDismiss]);

	// Don't render if not visible
	if (!isVisible || unreadCount <= 0) {
		return null;
	}

	/**
	 * Handle clicking the notification (switches to chat mode)
	 */
	const handleClick = () => {
		setIsVisible_(false);
		setTimeout(onSwitchToChat, 150); // Brief delay for smooth transition
	};

	/**
	 * Handle dismiss button (closes without switching)
	 */
	const handleDismiss = (e: React.MouseEvent) => {
		e.stopPropagation(); // Prevent triggering handleClick
		setIsVisible_(false);
		setTimeout(onDismiss, 300);
	};

	const suggestionText = unreadCount === 1 ? "suggestion" : "suggestions";

	return (
		<div
			className={`tutor-notification-toast ${isVisible_ ? "visible" : "hidden"}`}
			onClick={handleClick}
			role="alert"
			aria-live="polite"
		>
			<div className="tutor-toast-content">
				<div className="tutor-toast-icon">💡</div>
				<div className="tutor-toast-message">
					<div className="tutor-toast-title">{suggestionText} available!</div>
					<div className="tutor-toast-subtitle">
						{unreadCount} unread • Click to view in Chat Mode
					</div>
				</div>
				<button
					type="button"
					className="tutor-toast-dismiss"
					onClick={handleDismiss}
					aria-label="Dismiss notification"
				>
					<XMarkIcon className="tutor-toast-dismiss-icon" />
				</button>
			</div>
		</div>
	);
};

export default TutorNotificationToast;
