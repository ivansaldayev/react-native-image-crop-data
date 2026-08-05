import type { ReactElement } from "react";
import { ImageCrop } from "../src/ImageCrop";
import { ImageWithCrop } from "../src/ImageWithCrop";

/**
 * Case 8 (negative): `style` is deliberately excluded from `imageProps` (`Omit<P, "style">`) —
 * geometry belongs to the library alone, and a consumer must not be able to override it. Passing
 * `style` inside `imageProps` must fail to compile, on both components.
 */
export const StyleInImagePropsImageCrop = (): ReactElement => (
  <ImageCrop
    uri="https://example.com/photo.jpg"
    // @ts-expect-error - `style` is excluded from `imageProps`; the library owns geometry alone
    imageProps={{ style: { opacity: 0.5 } }}
  />
);

export const StyleInImagePropsImageWithCrop = (): ReactElement => (
  <ImageWithCrop
    uri="https://example.com/photo.jpg"
    cropData={{ scale: 1, translateX: 0, translateY: 0 }}
    // @ts-expect-error - `style` is excluded from `imageProps`; the library owns geometry alone
    imageProps={{ style: { opacity: 0.5 } }}
  />
);
