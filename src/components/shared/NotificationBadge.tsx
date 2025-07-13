/**
 * NotificationBadge Component
 * A reusable badge component for showing notification counts
 */

import type { FC } from "react";

interface NotificationBadgeProps {
	count: number;
	isVisible?: boolean;
	className?: string;
	maxCount?: number;
}

/**
 * NotificationBadge displays a small red badge with a count
 * Used for unread tutor suggestions and other notifications
 */
const NotificationBadge: FC<NotificationBadgeProps> = ({
	count,
	isVisible = true,
	className = "",
	maxCount = 99,
}) => {
	// Don't render if count is 0 or not visible
	if (count <= 0 || !isVisible) {
		return null;
	}

	// Format count (show "99+" for counts over maxCount)
	const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

	return (
		<span 
			className={`notification-badge ${className}`}
			role="status"
			aria-label={`${count} unread notification${count === 1 ? '' : 's'}`}
		>
			{displayCount}
		</span>
	);
};

export default NotificationBadge;