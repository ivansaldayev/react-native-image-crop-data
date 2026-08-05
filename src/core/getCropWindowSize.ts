import type { Size } from "../types";

/**
 * Computes the size of the crop window: the largest rectangle of the given `aspectRatio`
 * that fits inside `containerSize`, inset by `padding` on every side.
 *
 * The binding axis is chosen by comparing the aspect ratio of the *available* area
 * (`containerSize` minus the padding) against `aspectRatio` — not by comparing the
 * container's width to its height directly. Comparing raw sizes picks the wrong axis
 * whenever the container is taller than the target aspect ratio calls for, and can then
 * return a window that exceeds the container. Comparing aspect ratios instead guarantees
 * the result never exceeds `containerSize` on either axis.
 *
 * @param containerSize - Size of the container the crop window is inscribed into, in
 * pixels.
 * @param aspectRatio - Target width / height ratio of the crop window (`1` = square,
 * `0.75` = 3:4 portrait, `1.7778` = 16:9 — see the module's `aspectRatio` convention).
 * Must be greater than `0`.
 * @param padding - Inset applied on **each** side of the container, in pixels (so it is
 * subtracted twice per axis: once from each edge). Defaults to `0`. Must leave a positive
 * available width and height.
 * @returns The crop window's `{ width, height }`, always within `containerSize`.
 */
export const getCropWindowSize = (containerSize: Size, aspectRatio: number, padding = 0): Size => {
  const availableWidth = containerSize.width - padding * 2;
  const availableHeight = containerSize.height - padding * 2;
  const availableRatio = availableWidth / availableHeight;

  if (availableRatio > aspectRatio) {
    const height = availableHeight;
    return { width: height * aspectRatio, height };
  }

  const width = availableWidth;
  return { width, height: width / aspectRatio };
};
