import { clamp } from "../index";

describe("clamp", () => {
  test("passes a value through unchanged when it is within bounds", () => {
    expect(clamp(50, 0, 100)).toBe(50);
    expect(clamp(0.3, 0, 1)).toBeCloseTo(0.3, 10);
  });

  test("returns min when the value is below the lower bound", () => {
    expect(clamp(-10, 0, 100)).toBe(0);
    expect(clamp(-1000, -5, 5)).toBe(-5);
  });

  test("returns max when the value is above the upper bound", () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(1000, -5, 5)).toBe(5);
  });

  test("returns the bound itself when the value equals it exactly", () => {
    expect(clamp(0, 0, 100)).toBe(0);
    expect(clamp(100, 0, 100)).toBe(100);
  });

  test("works with a fully negative range", () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(-20, -10, -1)).toBe(-10);
    expect(clamp(5, -10, -1)).toBe(-1);
  });

  test("clamps a fractional value against a fractional bound", () => {
    expect(clamp(2.5, 0, 1)).toBe(1);
  });
});
