import type { Size } from "../../types";
import { getDisplaySize } from "../index";

describe("getDisplaySize", () => {
  test("width-bound branch: an image proportionally wider than the container is limited by the container's width", () => {
    const imageSize: Size = { width: 1600, height: 900 };
    const containerSize: Size = { width: 400, height: 400 };
    const result = getDisplaySize(imageSize, containerSize);
    expect(result.width).toBe(400);
    expect(result.height).toBeCloseTo(225, 6);
  });

  test("height-bound branch: an image proportionally taller than the container is limited by the container's height", () => {
    const imageSize: Size = { width: 900, height: 1600 };
    const containerSize: Size = { width: 400, height: 400 };
    const result = getDisplaySize(imageSize, containerSize);
    expect(result.height).toBe(400);
    expect(result.width).toBe(225);
  });

  test("square image inside a non-square container: the shorter container side is the limit", () => {
    const imageSize: Size = { width: 500, height: 500 };
    const containerSize: Size = { width: 300, height: 200 };
    expect(getDisplaySize(imageSize, containerSize)).toEqual({ width: 200, height: 200 });
  });

  test("square image inside a square container fills it exactly", () => {
    const imageSize: Size = { width: 500, height: 500 };
    const containerSize: Size = { width: 300, height: 300 };
    expect(getDisplaySize(imageSize, containerSize)).toEqual({ width: 300, height: 300 });
  });

  test("matching non-square aspect ratios fill the container exactly, with no letterboxing", () => {
    const imageSize: Size = { width: 1250, height: 1000 }; // aspect 1.25
    const containerSize: Size = { width: 1000, height: 800 }; // aspect 1.25
    expect(getDisplaySize(imageSize, containerSize)).toEqual({ width: 1000, height: 800 });
  });
});
