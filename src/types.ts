import type { ImageStyle, StyleProp } from "react-native";

/**
 * A width/height pair, in pixels unless a specific field's documentation says otherwise.
 */
export interface Size {
  /** Width in pixels. */
  width: number;
  /** Height in pixels. */
  height: number;
}

/**
 * A non-destructive crop transform.
 *
 * `CropData` is **not** a pixel rectangle. It is a normalised description of how an image
 * is positioned and zoomed relative to a crop window, so it can be stored, replayed at any
 * preview size, and re-opened for editing without ever touching the original file.
 *
 * All three numbers are normalised (unit-less ratios), not pixel values. The object is plain
 * JSON — safe to `JSON.stringify` and persist (e.g. in a database record for an image).
 *
 * **Only valid for the `aspectRatio` it was created with.** `CropData` captures a position and
 * zoom relative to a crop window of a specific width/height ratio; applying it against a crop
 * window of a different `aspectRatio` produces a wrong (misaligned) crop. Recreate the
 * `CropData` whenever the target `aspectRatio` changes.
 */
export interface CropData {
  /**
   * Zoom level, relative to "the image exactly covers the crop window".
   *
   * `1` means the image exactly covers the crop window (the smallest zoom at which no empty
   * space is visible inside the window). This is also the minimum: `scale` is never below `1`,
   * since the image can never be zoomed out past the point where it stops covering the window.
   */
  scale: number;
  /**
   * Horizontal offset of the image's centre from the crop window's centre, expressed as a
   * fraction of the crop window's **width**. `0` means the image is horizontally centred.
   */
  translateX: number;
  /**
   * Vertical offset of the image's centre from the crop window's centre, expressed as a
   * fraction of the crop window's **height**. `0` means the image is vertically centred.
   */
  translateY: number;
}

/**
 * A crop rectangle in the pixel coordinate space of the **source** image.
 *
 * This is the "physical" counterpart of {@link CropData}: the raw rectangle to hand to an
 * image-manipulation function (native or server-side) in order to actually cut pixels.
 */
export interface CropRect {
  /** Left edge of the rectangle, in source-image pixels. */
  x: number;
  /** Top edge of the rectangle, in source-image pixels. */
  y: number;
  /** Width of the rectangle, in source-image pixels. */
  width: number;
  /** Height of the rectangle, in source-image pixels. */
  height: number;
}

/**
 * The neutral {@link CropData}: no zoom beyond "covers the crop window", no offset.
 *
 * Applying `IDENTITY_CROP` against a given `aspectRatio` yields the centred crop for that
 * aspect ratio — the same result a user would get by opening the cropper and applying it
 * immediately without any pinch or pan.
 */
export const IDENTITY_CROP: CropData = { scale: 1, translateX: 0, translateY: 0 };

/**
 * Minimal prop surface a component must accept to be usable as an injected image renderer.
 *
 * The library constrains only `style`, because geometry — the size and transform of the image
 * box — is the one thing it must own exclusively; letting it be overridden from outside would
 * silently break the crop. Every other prop the renderer accepts flows through `imageProps`,
 * fully typed for the renderer actually passed.
 *
 * Deliberately structural rather than a union of concrete renderer types: both React Native's
 * `Image` and `expo-image`'s `Image` are classes with mutually incompatible `source` types, so
 * no narrow shared contract covering both can exist. Constraining only what the library owns is
 * what lets either — and any third renderer — be accepted with no casts on the consumer side.
 *
 * The `import type` below is erased at compile time, so this module still pulls in no runtime
 * dependency.
 */
export interface CropImageBaseProps {
  style?: StyleProp<ImageStyle>;
}
