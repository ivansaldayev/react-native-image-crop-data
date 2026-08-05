/**
 * Restricts `value` to the inclusive range `[min, max]`.
 *
 * Runs on the UI thread: this function is a Reanimated worklet (its body starts with the
 * `"worklet"` directive), so it can be called from `useAnimatedStyle`, gesture `onUpdate`
 * handlers, and other worklet contexts without a thread-boundary crash.
 *
 * @param value - The number to clamp.
 * @param min - The lower bound of the range, inclusive. Must be less than or equal to `max`.
 * @param max - The upper bound of the range, inclusive.
 * @returns `value` if it already lies within `[min, max]`; otherwise the nearer bound.
 */
export const clamp = (value: number, min: number, max: number): number => {
  "worklet";
  return Math.min(max, Math.max(min, value));
};
