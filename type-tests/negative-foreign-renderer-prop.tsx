import type { ReactElement } from "react";
import { Image } from "react-native";
import { ImageCrop } from "../src/ImageCrop";
import { ImageWithCrop } from "../src/ImageWithCrop";

/**
 * Case 7 (negative): `cachePolicy` is an `expo-image`-only prop. With `ImageComponent` set to
 * RN's `Image`, `imageProps` is typed as `Omit<ImageProps, "style">` (RN's own props), which has
 * no `cachePolicy` at all — this must fail to compile.
 */
export const ForeignRendererPropImageCrop = (): ReactElement => (
  // @ts-expect-error - `cachePolicy` does not exist on RN `Image`'s props
  <ImageCrop uri="https://example.com/photo.jpg" ImageComponent={Image} imageProps={{ cachePolicy: "memory-disk" }} />
);

export const ForeignRendererPropImageWithCrop = (): ReactElement => (
  <ImageWithCrop
    uri="https://example.com/photo.jpg"
    cropData={{ scale: 1, translateX: 0, translateY: 0 }}
    ImageComponent={Image}
    // @ts-expect-error - `cachePolicy` does not exist on RN `Image`'s props
    imageProps={{ cachePolicy: "memory-disk" }}
  />
);
