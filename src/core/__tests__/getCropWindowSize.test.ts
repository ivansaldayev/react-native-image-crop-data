import type { Size } from "../../types";
import { getCropWindowSize } from "../index";

describe("getCropWindowSize", () => {
  test("regression: a container taller than it is wide, with a portrait crop aspect, never yields a window taller than the container", () => {
    const containerSize: Size = { width: 400, height: 450 };
    const aspectRatio = 0.75; // 3:4 portrait, width/height convention
    const result = getCropWindowSize(containerSize, aspectRatio);
    // Branching on aspect ratios (fixed) rather than raw sizes (the historical bug) keeps this
    // height-bound: height fills the container, width follows from the aspect ratio. The buggy
    // formula picks the other branch here and returns height 533, taller than the container.
    expect(result).toEqual({ width: 337.5, height: 450 });
    expect(result.height).toBeLessThanOrEqual(containerSize.height);
    expect(result.width).toBeLessThanOrEqual(containerSize.width);
  });

  test("width-bound branch: a wide crop aspect inside a tall container is limited by the container's width", () => {
    const containerSize: Size = { width: 300, height: 800 };
    const aspectRatio = 2; // 2:1 landscape crop
    expect(getCropWindowSize(containerSize, aspectRatio)).toEqual({ width: 300, height: 150 });
  });

  test("height-bound branch: a narrow crop aspect inside a wide container is limited by the container's height", () => {
    const containerSize: Size = { width: 800, height: 300 };
    const aspectRatio = 1; // square crop
    expect(getCropWindowSize(containerSize, aspectRatio)).toEqual({ width: 300, height: 300 });
  });

  test("square container with a square crop aspect fills the container exactly", () => {
    const containerSize: Size = { width: 500, height: 500 };
    expect(getCropWindowSize(containerSize, 1)).toEqual({ width: 500, height: 500 });
  });

  test("square container with a non-square crop aspect is bound by the shorter resulting side", () => {
    const containerSize: Size = { width: 500, height: 500 };
    expect(getCropWindowSize(containerSize, 0.5)).toEqual({ width: 250, height: 500 });
  });

  test("padding insets each side, so it is subtracted twice per axis", () => {
    const containerSize: Size = { width: 300, height: 300 };
    // Available space is 300 - 50*2 = 200 on each axis, not 300 - 50 = 250.
    expect(getCropWindowSize(containerSize, 1, 50)).toEqual({ width: 200, height: 200 });
  });

  test("padding combined with a non-square aspect ratio and a non-square container", () => {
    const containerSize: Size = { width: 600, height: 400 };
    // Available area: 500 x 300. Height-bound: height = 300, width = 150.
    expect(getCropWindowSize(containerSize, 0.5, 50)).toEqual({ width: 150, height: 300 });
  });

  test("defaults padding to 0 when omitted", () => {
    const containerSize: Size = { width: 400, height: 450 };
    const withExplicitZero = getCropWindowSize(containerSize, 0.75, 0);
    const withOmittedPadding = getCropWindowSize(containerSize, 0.75);
    expect(withOmittedPadding).toEqual(withExplicitZero);
  });

  test("never returns a window larger than the container, across a sweep of aspect ratios, container shapes, and padding", () => {
    const aspectRatios = [0.25, 0.5, 0.75, 1, 1.5, 2, 4, 16 / 9];
    const containerSizes: Size[] = [
      { width: 400, height: 450 },
      { width: 450, height: 400 },
      { width: 300, height: 300 },
      { width: 1200, height: 300 },
      { width: 300, height: 1200 },
      { width: 800, height: 800 },
    ];
    const paddings = [0, 8, 40];
    const EPSILON = 1e-9;

    const violations: string[] = [];
    for (const aspectRatio of aspectRatios) {
      for (const containerSize of containerSizes) {
        for (const padding of paddings) {
          const result = getCropWindowSize(containerSize, aspectRatio, padding);
          const availableWidth = containerSize.width - 2 * padding;
          const availableHeight = containerSize.height - 2 * padding;
          const withinBounds =
            result.width <= containerSize.width + EPSILON &&
            result.height <= containerSize.height + EPSILON &&
            result.width <= availableWidth + EPSILON &&
            result.height <= availableHeight + EPSILON;
          if (!withinBounds) {
            violations.push(
              `aspectRatio=${aspectRatio} container=${containerSize.width}x${containerSize.height} padding=${padding} -> ${JSON.stringify(result)}`,
            );
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
