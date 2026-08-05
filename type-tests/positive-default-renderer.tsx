import type { ReactElement } from "react";
import { ImageCrop } from "../src/ImageCrop";
import { ImageWithCrop } from "../src/ImageWithCrop";

/**
 * Case 1 (positive): neither component is given an `ImageComponent` at all — the default
 * RN `Image` renderer must work out of the box, with zero casts.
 */
export const DefaultRendererImageCrop = (): ReactElement => <ImageCrop uri="https://example.com/photo.jpg" />;

export const DefaultRendererImageWithCrop = (): ReactElement => (
  <ImageWithCrop uri="https://example.com/photo.jpg" cropData={{ scale: 1, translateX: 0, translateY: 0 }} />
);
