/**
 * Resolves the absolute upper bound for the pinch gesture's scale, from `initialScale` (the
 * absolute scale at which the image exactly covers the crop window) and `maxScale` (a
 * multiplier of that cover scale — the same unit as `CropData`'s `scale`, since
 * `CropData.scale` is exactly `rawScale / initialScale`).
 *
 * A `maxScale` below `1` is treated as `1`, so the result is never less than `initialScale`.
 * This guarantees `initialScale <= getMaxScale(initialScale, maxScale)` for every input,
 * satisfying `clamp`'s precondition that its `min` argument never exceeds its `max` — covering
 * the crop window always wins over a misconfigured (or degenerate) `maxScale`.
 *
 * Runs on the UI thread: this function is a Reanimated worklet (its body starts with the
 * `"worklet"` directive), so it can be called from gesture `onUpdate` handlers without a
 * thread-boundary crash.
 *
 * @param initialScale - The absolute scale that makes the image exactly cover the crop window.
 * @param maxScale - Maximum zoom, as a multiplier of `initialScale`.
 * @returns The absolute scale the pinch gesture may not exceed.
 */
export const getMaxScale = (initialScale: number, maxScale: number): number => {
  "worklet";
  return initialScale * Math.max(1, maxScale);
};
