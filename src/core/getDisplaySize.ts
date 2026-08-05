import type { Size } from "../types";

/**
 * Computes the contain-fit display size of an image inside a container.
 *
 * Scales `imageSize` down or up, preserving its aspect ratio, so the result fits entirely
 * inside `containerSize` with no overflow on either axis (equivalent to CSS
 * `object-fit: contain`). One of the two returned dimensions always equals the matching
 * `containerSize` dimension; the other is derived from the image's aspect ratio.
 *
 * Runs on the UI thread: this function is a Reanimated worklet (its body starts with the
 * `"worklet"` directive), so it can be called from `useAnimatedStyle` and other worklet
 * contexts without a thread-boundary crash.
 *
 * @param imageSize - Natural size of the image, in pixels. Both sides must be non-zero.
 * @param containerSize - Size of the container the image is fit into, in pixels. Both sides
 * must be non-zero — a zero side turns a ratio into `NaN`; callers must not invoke this
 * before both sizes are known and non-zero.
 * @returns The size at which the image should be displayed to exactly contain-fit inside
 * `containerSize`.
 */
export const getDisplaySize = (imageSize: Size, containerSize: Size): Size => {
  "worklet";
  const { width: containerWidth, height: containerHeight } = containerSize;

  const imageRatio = imageSize.width / imageSize.height;
  const containerRatio = containerWidth / containerHeight;

  if (imageRatio > containerRatio) {
    return {
      width: containerWidth,
      height: containerWidth / imageRatio,
    };
  }

  return {
    height: containerHeight,
    width: containerHeight * imageRatio,
  };
};
