import type { ReactElement } from "react";
import { Image } from "react-native";
import { ImageCrop } from "../src/ImageCrop";
import { ImageWithCrop } from "../src/ImageWithCrop";

/**
 * Case 2 (positive): `ImageComponent` explicitly set to `Image` from `react-native`, with
 * `imageProps` using props that only this renderer has (`resizeMode`, `blurRadius`).
 */
export const ReactNativeRendererImageCrop = (): ReactElement => (
  <ImageCrop
    uri="https://example.com/photo.jpg"
    ImageComponent={Image}
    imageProps={{ resizeMode: "cover", blurRadius: 2 }}
  />
);

export const ReactNativeRendererImageWithCrop = (): ReactElement => (
  <ImageWithCrop
    uri="https://example.com/photo.jpg"
    cropData={{ scale: 1, translateX: 0, translateY: 0 }}
    ImageComponent={Image}
    imageProps={{ resizeMode: "contain", blurRadius: 4 }}
  />
);
