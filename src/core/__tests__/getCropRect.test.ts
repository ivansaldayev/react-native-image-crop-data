import type { CropData, Size } from "../../types";
import { IDENTITY_CROP } from "../../types";
import { getCropRect } from "../index";

describe("getCropRect", () => {
  test("IDENTITY_CROP with a matching image/aspect ratio returns the whole image frame", () => {
    const imageSize: Size = { width: 900, height: 600 }; // aspect 1.5
    const result = getCropRect({ imageSize, aspectRatio: 1.5, cropData: IDENTITY_CROP });
    expect(result).toEqual({ x: 0, y: 0, width: 900, height: 600 });
  });

  test("IDENTITY_CROP with a differing aspect ratio returns the centred crop for that aspect", () => {
    const imageSize: Size = { width: 1000, height: 500 }; // landscape 2:1
    const result = getCropRect({ imageSize, aspectRatio: 1, cropData: IDENTITY_CROP }); // square window
    expect(result).toEqual({ x: 250, y: 0, width: 500, height: 500 });
  });

  test("a non-identity scale and translate produce a rect that is hand-verifiable and stays in bounds", () => {
    const imageSize: Size = { width: 2000, height: 1000 };
    const cropData: CropData = { scale: 2, translateX: 0.25, translateY: -0.125 };
    const result = getCropRect({ imageSize, aspectRatio: 1, cropData, rounding: "none" });
    expect(result).toEqual({ x: 625, y: 312.5, width: 500, height: 500 });
  });

  test("rounds to whole pixels by default, so the rect can go straight into a manipulator", () => {
    const imageSize: Size = { width: 2000, height: 1000 };
    const cropData: CropData = { scale: 2, translateX: 0.25, translateY: -0.125 };
    const result = getCropRect({ imageSize, aspectRatio: 1, cropData });
    expect(result).toEqual({ x: 625, y: 313, width: 500, height: 500 });
  });

  test("keeps fractional output only when rounding is disabled", () => {
    const imageSize: Size = { width: 100, height: 100 };
    const cropData: CropData = { scale: 3, translateX: 0, translateY: 0 };

    const exact = getCropRect({ imageSize, aspectRatio: 1, cropData, rounding: "none" });
    expect(exact.width).toBeCloseTo(100 / 3, 10);
    expect(Number.isInteger(exact.width)).toBe(false);

    const rounded = getCropRect({ imageSize, aspectRatio: 1, cropData });
    expect(Number.isInteger(rounded.width)).toBe(true);
    expect(rounded.width).toBe(33);
  });

  test("rounding never pushes the rect past the image edge (the trap the export recipe used to carry)", () => {
    // Rounding x up while width also rounds up is what put `x + width` one pixel outside.
    const imageSize: Size = { width: 100, height: 100 };
    const cropData: CropData = { scale: 1.005, translateX: 0.499, translateY: 0.499 };

    const result = getCropRect({ imageSize, aspectRatio: 1, cropData });

    expect(result.x + result.width).toBeLessThanOrEqual(imageSize.width);
    expect(result.y + result.height).toBeLessThanOrEqual(imageSize.height);
  });

  test("does not collapse to a zero or sub-pixel rect at a high zoom on a small image (R8)", () => {
    const imageSize: Size = { width: 100, height: 100 };
    const cropData: CropData = { scale: 20, translateX: 0, translateY: 0 };
    const result = getCropRect({ imageSize, aspectRatio: 1, cropData });
    expect(result.width).toBeCloseTo(5, 10);
    expect(result.height).toBeCloseTo(5, 10);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  test("is unaffected by an injected container-shaped field, guarding the no-container-dependency invariant", () => {
    const imageSize: Size = { width: 1200, height: 800 };
    const aspectRatio = 0.75;
    const cropData: CropData = { scale: 1.6, translateX: 0.2, translateY: -0.15 };

    const baseline = getCropRect({ imageSize, aspectRatio, cropData });

    // getCropRect's signature has no containerSize field, so a correct implementation cannot be
    // affected by one. If a future edit reintroduced a container dependency (e.g. an optional
    // `containerSize` consulted only when present), this unrelated extra property would change
    // the result below and this test would fail.
    const withInjectedContainer = getCropRect({
      imageSize,
      aspectRatio,
      cropData,
      containerSize: { width: 50, height: 50 },
    } as unknown as Parameters<typeof getCropRect>[0]);

    expect(withInjectedContainer).toEqual(baseline);
  });

  test("is deterministic: repeated calls with the same input return the same output", () => {
    const imageSize: Size = { width: 1234, height: 987 };
    const aspectRatio = 16 / 9;
    const cropData: CropData = { scale: 3.3, translateX: -0.4, translateY: 0.1 };

    const first = getCropRect({ imageSize, aspectRatio, cropData });
    const second = getCropRect({ imageSize, aspectRatio, cropData });

    expect(second).toEqual(first);
  });

  describe("property sweep: aspect ratio x image orientation x scale x translate", () => {
    const aspectRatios = [0.5, 0.75, 1, 1.5, 2, 16 / 9];
    const imageSizes: Size[] = [
      { width: 1600, height: 900 }, // landscape
      { width: 900, height: 1600 }, // portrait
      { width: 1000, height: 1000 }, // square
      { width: 2000, height: 200 }, // extreme landscape
      { width: 200, height: 2000 }, // extreme portrait
    ];
    const scales = [1, 1.5, 3, 10, 20];
    const translates = [-5, -0.999, -0.5, 0, 0.5, 0.999, 5];
    const EPSILON = 1e-9;

    test("the exact rect always stays inside the image bounds", () => {
      const violations: string[] = [];
      for (const aspectRatio of aspectRatios) {
        for (const imageSize of imageSizes) {
          for (const scale of scales) {
            for (const translateX of translates) {
              for (const translateY of translates) {
                const rect = getCropRect({
                  imageSize,
                  aspectRatio,
                  cropData: { scale, translateX, translateY },
                  rounding: "none",
                });
                const inBounds =
                  rect.width > 0 &&
                  rect.height > 0 &&
                  rect.x >= -EPSILON &&
                  rect.y >= -EPSILON &&
                  rect.x + rect.width <= imageSize.width + EPSILON &&
                  rect.y + rect.height <= imageSize.height + EPSILON;
                if (!inBounds) {
                  violations.push(
                    `aspectRatio=${aspectRatio} image=${imageSize.width}x${imageSize.height} scale=${scale} translateX=${translateX} translateY=${translateY} -> ${JSON.stringify(rect)}`,
                  );
                }
              }
            }
          }
        }
      }
      expect(violations).toEqual([]);
    });

    test("whole-pixel output stays inside the bounds and never degenerates", () => {
      const violations: string[] = [];
      for (const aspectRatio of aspectRatios) {
        for (const imageSize of imageSizes) {
          for (const scale of scales) {
            for (const translateX of translates) {
              for (const translateY of translates) {
                const rect = getCropRect({ imageSize, aspectRatio, cropData: { scale, translateX, translateY } });
                const usable =
                  Number.isInteger(rect.x) &&
                  Number.isInteger(rect.y) &&
                  Number.isInteger(rect.width) &&
                  Number.isInteger(rect.height) &&
                  rect.width >= 1 &&
                  rect.height >= 1 &&
                  rect.x >= 0 &&
                  rect.y >= 0 &&
                  rect.x + rect.width <= imageSize.width &&
                  rect.y + rect.height <= imageSize.height;
                if (!usable) {
                  violations.push(
                    `aspectRatio=${aspectRatio} image=${imageSize.width}x${imageSize.height} scale=${scale} translateX=${translateX} translateY=${translateY} -> ${JSON.stringify(rect)}`,
                  );
                }
              }
            }
          }
        }
      }
      expect(violations).toEqual([]);
    });

    test("the exact rect's aspect ratio always matches the requested aspectRatio", () => {
      const violations: string[] = [];
      for (const aspectRatio of aspectRatios) {
        for (const imageSize of imageSizes) {
          for (const scale of scales) {
            for (const translateX of translates) {
              for (const translateY of translates) {
                const rect = getCropRect({
                  imageSize,
                  aspectRatio,
                  cropData: { scale, translateX, translateY },
                  rounding: "none",
                });
                const actualRatio = rect.width / rect.height;
                if (Math.abs(actualRatio - aspectRatio) > 1e-9) {
                  violations.push(
                    `aspectRatio=${aspectRatio} image=${imageSize.width}x${imageSize.height} scale=${scale} translateX=${translateX} translateY=${translateY} -> actual=${actualRatio}`,
                  );
                }
              }
            }
          }
        }
      }
      expect(violations).toEqual([]);
    });
  });
});
