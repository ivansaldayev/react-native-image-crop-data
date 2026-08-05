import { getDisplaySize, getMaxScale } from "../index";

describe("getMaxScale", () => {
  test("returns initialScale times maxScale for a normal (>= 1) multiplier", () => {
    expect(getMaxScale(1, 20)).toBe(20);
    expect(getMaxScale(2, 5)).toBe(10);
    expect(getMaxScale(0.5, 4)).toBe(2);
  });

  test("treats a maxScale below 1 as 1, so the result never drops below initialScale", () => {
    expect(getMaxScale(3, 0.5)).toBe(3);
    expect(getMaxScale(3, 0)).toBe(3);
    expect(getMaxScale(3, -10)).toBe(3);
  });

  test("result is always >= initialScale, whatever maxScale is", () => {
    for (const initialScale of [0.01, 0.5, 1, 3, 12.7]) {
      for (const maxScale of [-100, 0, 0.3, 1, 5, 20]) {
        expect(getMaxScale(initialScale, maxScale)).toBeGreaterThanOrEqual(initialScale);
      }
    }
  });

  test("regression: an extreme aspect-ratio mismatch (initialScale > default maxScale) still covers", () => {
    // A 10000x100 panorama contain-fit into a 400x400 container: the display height (4) is
    // tiny relative to the container, so the scale needed to cover a square crop window
    // (400/4 = 100) exceeds the library's default maxScale of 20. Before the fix, clamping the
    // absolute scale to maxScale=20 would leave the crop window uncovered (gaps at the edges);
    // getMaxScale folds maxScale into a multiplier of initialScale instead, so covering always
    // wins.
    const imageSize = { width: 10000, height: 100 };
    const containerSize = { width: 400, height: 400 };
    const displaySize = getDisplaySize(imageSize, containerSize);
    const initialScale = Math.max(containerSize.width / displaySize.width, containerSize.height / displaySize.height);

    expect(initialScale).toBeGreaterThan(20);

    const maxScale = getMaxScale(initialScale, 20);
    expect(maxScale).toBeGreaterThanOrEqual(initialScale);
  });
});
