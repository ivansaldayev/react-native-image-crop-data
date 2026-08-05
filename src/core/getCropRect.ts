import type { CropData, CropRect, Size } from "../types";

/**
 * Translates a normalised {@link CropData} into a pixel {@link CropRect} on the source
 * image — the rectangle to hand to an image-manipulation function in order to physically
 * cut pixels.
 *
 * The result depends **only** on `imageSize`, `aspectRatio` and `cropData` — never on any
 * container or display size (the central invariant of the library: a `CropData` recorded
 * once stays valid across devices, orientations and preview sizes).
 *
 * By default the rectangle is rounded to whole pixels and kept fully inside `imageSize`, so
 * it can be handed straight to a native image manipulator (all of them — `expo-image-
 * manipulator`, `@react-native-community/image-editor`, `sharp` — require integers). Rounding
 * happens before the final clamp precisely because rounding up can otherwise push a coordinate
 * one pixel past the image edge.
 *
 * The trade-off is explicit: whole-pixel sides cannot hold an exact `aspectRatio`, so the
 * returned ratio may differ from the requested one by up to a pixel. Pass
 * `rounding: "none"` to get the exact fractional rectangle instead — the ratio is then exact,
 * and rounding (plus re-clamping) becomes the caller's responsibility.
 *
 * @param params.imageSize - Natural size of the source image, in pixels. Both sides must
 * be non-zero.
 * @param params.aspectRatio - Target width / height ratio the crop was made for (`1` =
 * square, `0.75` = 3:4 portrait, `1.7778` = 16:9 — see the module's `aspectRatio`
 * convention). Must be greater than `0`, and must be the same `aspectRatio` the `cropData`
 * was produced with (§ `CropData` invariant).
 * @param params.cropData - The normalised crop transform to convert. `cropData.scale` is
 * expected to be `>= 1`, per {@link CropData}. A very high `scale` relative to
 * `imageSize`'s resolution yields a small (or, in the extreme, sub-pixel) rectangle — this
 * is expected behaviour of the underlying math, not a defect of this function; callers
 * that need to avoid tiny export rectangles should bound the zoom relative to the source
 * resolution before recording `cropData`.
 * @param params.rounding - `"integer"` (default) rounds the rectangle to whole pixels, ready
 * for a native manipulator; `"none"` returns the exact fractional rectangle.
 * @returns The crop rectangle in source-image pixel coordinates, fully contained within
 * `imageSize`.
 */
export const getCropRect = ({
  imageSize,
  aspectRatio,
  cropData,
  rounding = "integer",
}: {
  imageSize: Size;
  aspectRatio: number;
  cropData: CropData;
  rounding?: "integer" | "none";
}): CropRect => {
  const imageRatio = imageSize.width / imageSize.height;

  let cropWidth: number;
  let cropHeight: number;

  if (imageRatio > aspectRatio) {
    cropHeight = imageSize.height / cropData.scale;
    cropWidth = cropHeight * aspectRatio;
  } else {
    cropWidth = imageSize.width / cropData.scale;
    cropHeight = cropWidth / aspectRatio;
  }

  const centerX = imageSize.width / 2;
  const centerY = imageSize.height / 2;

  const pixelOffsetX = cropData.translateX * cropWidth;
  const pixelOffsetY = cropData.translateY * cropHeight;

  const originX = centerX - cropWidth / 2 - pixelOffsetX;
  const originY = centerY - cropHeight / 2 - pixelOffsetY;

  const x = Math.max(0, Math.min(originX, imageSize.width - cropWidth));
  const y = Math.max(0, Math.min(originY, imageSize.height - cropHeight));

  const width = Math.min(cropWidth, imageSize.width - x);
  const height = Math.min(cropHeight, imageSize.height - y);

  if (rounding === "none") {
    return { x, y, width, height };
  }

  // Clamped after rounding, not before: rounding up can push a coordinate one pixel past the
  // edge. The lower bounds keep the rectangle usable — a manipulator handed a zero-sized rect
  // either throws or silently returns the whole image.
  const roundedX = Math.max(0, Math.min(Math.round(x), imageSize.width - 1));
  const roundedY = Math.max(0, Math.min(Math.round(y), imageSize.height - 1));

  return {
    x: roundedX,
    y: roundedY,
    width: Math.max(1, Math.min(Math.round(width), imageSize.width - roundedX)),
    height: Math.max(1, Math.min(Math.round(height), imageSize.height - roundedY)),
  };
};
