import { useState, useRef, useEffect } from "react";
import type React from "react";
import { setupModalBackButtonHandler } from "../../utils/modalBackButtonHandler";
import { ReactCrop } from "react-image-crop";
import type { Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

interface ImageCropperProps {
	src: string;
	onCrop: (croppedImage: string) => void;
	onCancel: () => void;
	aspectRatio?: number;
}

const ImageCropper: React.FC<ImageCropperProps> = ({
	src,
	onCrop,
	onCancel,
	aspectRatio = 3 / 4, // Default to 3:4 aspect ratio for sprites
}) => {
	// Initialize with a default crop that has proper proportions
	// This ensures the crop box appears immediately with the correct ratio
	const [crop, setCrop] = useState<Crop>({
		unit: "%",
		width: 60, // Starting width
		height: 90, // Starting height (maintains 2:3 ratio)
		x: 20, // Center horizontally
		y: 5, // Position near top
	});
	const [completedCrop, setCompletedCrop] = useState<Crop | null>(null);
	const imgRef = useRef<HTMLImageElement>(null);
	// const previewImgRef = useRef<HTMLImageElement>(null);

	// Store the original image dimensions
	const [originalImageDimensions, setOriginalImageDimensions] = useState<{
		width: number;
		height: number;
	} | null>(null);

	// When image loads, get its natural dimensions and adjust crop if needed
	useEffect(() => {
		const img = new Image();
		img.src = src;
		img.onload = () => {
			// Store the original image dimensions for use in the final crop
			setOriginalImageDimensions({
				width: img.naturalWidth,
				height: img.naturalHeight,
			});

			// Calculate a centered crop that maintains the 2:3 ratio
			// We want to ensure the crop box is visible and properly sized
			const imageRatio = img.width / img.height;

			// Default crop size (60% width, height adjusted for 2:3 ratio)
			let newCrop: Crop;

			if (imageRatio > aspectRatio) {
				// For wider images, base on height
				const cropHeight = 80;
				const cropWidth = cropHeight * aspectRatio;

				newCrop = {
					unit: "%",
					width: cropWidth,
					height: cropHeight,
					x: (100 - cropWidth) / 2,
					y: 10,
				};
			} else {
				// For taller images, base on width
				const cropWidth = 60;
				const cropHeight = cropWidth / aspectRatio;

				newCrop = {
					unit: "%",
					width: cropWidth,
					height: cropHeight,
					x: (100 - cropWidth) / 2,
					y: 10,
				};
			}

			// Set the crop state to apply it immediately
			setCrop(newCrop);
			setCompletedCrop(newCrop);
		};
	}, [src, aspectRatio]);

	// Add new useEffect for back button handling
	useEffect(() => {
		// Set up back button handler
		const cleanup = setupModalBackButtonHandler(onCancel);

		// Cleanup when component unmounts
		return cleanup;
	}, [onCancel]);

	const onCropChange = (_newCrop: Crop, percentCrop: Crop) => {
		setCrop(percentCrop);
	};

	const onCropComplete = (_crop: Crop, percentCrop: Crop) => {
		setCompletedCrop(percentCrop);
	};

	const handleCropImage = () => {
		if (!imgRef.current || !completedCrop || !originalImageDimensions) return;

		const canvas = document.createElement("canvas");
		// @ts-ignore - Will be used in future implementations
		const image = imgRef.current;

		// Use the original dimensions instead of the displayed dimensions
		const scaleX = originalImageDimensions.width / 100;
		const scaleY = originalImageDimensions.height / 100;

		// Calculate the pixel values from percentages
		const pixelCrop = {
			x: Math.round(completedCrop.x * scaleX),
			y: Math.round(completedCrop.y * scaleY),
			width: Math.round(completedCrop.width * scaleX),
			height: Math.round(completedCrop.height * scaleY),
		};

		// Set the canvas to the final crop size at full resolution
		canvas.width = pixelCrop.width;
		canvas.height = pixelCrop.height;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Create a temporary image with the original source
		// This approach ensures we're working with the full-resolution image
		const tempImage = new Image();
		tempImage.onload = () => {
			// Draw the cropped portion of the original image at full resolution
			ctx.drawImage(
				tempImage,
				pixelCrop.x,
				pixelCrop.y,
				pixelCrop.width,
				pixelCrop.height,
				0,
				0,
				pixelCrop.width,
				pixelCrop.height,
			);

			// Convert to base64 URL at maximum quality
			const base64Image = canvas.toDataURL("image/png", 1.0);
			onCrop(base64Image);
		};

		// Set crossOrigin to anonymous to avoid CORS issues with the temp image
		tempImage.crossOrigin = "anonymous";
		tempImage.src = src;
	};

	return (
		<div className="image-cropper-modal">
			<div className="image-cropper-content">
				<h3>Crop Image (2:3 Aspect Ratio)</h3>
				<p>Resize the crop area while maintaining the 2:3 portrait ratio</p>
				<div className="crop-container">
					<ReactCrop
						crop={crop}
						onChange={onCropChange}
						onComplete={onCropComplete}
						aspect={2 / 3} // Fixed 2:3 aspect ratio
						keepSelection
						minWidth={30}
						minHeight={45} // 30 * (3/2) = 45
					>
						<img
							ref={imgRef}
							src={src}
							alt="Crop preview"
							style={{ maxHeight: "500px", maxWidth: "100%" }}
							crossOrigin="anonymous"
						/>
					</ReactCrop>
				</div>
				<div className="cropper-actions">
					<button type="button" onClick={onCancel} className="cancel-button">
						Cancel
					</button>
					<button
						type="button"
						onClick={handleCropImage}
						className="confirm-button"
					>
						Confirm Crop
					</button>
				</div>
			</div>
		</div>
	);
};

export default ImageCropper;
