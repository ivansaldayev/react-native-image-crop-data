import type { ReactElement } from "react";
import { Image as ExpoImage } from "expo-image";
import { ImageCrop } from "../src/ImageCrop";
import { ImageWithCrop } from "../src/ImageWithCrop";

/**
 * Case 3 (positive): `ImageComponent` set to `expo-image`'s `Image`, with `imageProps` using
 * props that only that renderer has (`cachePolicy`, `contentFit`, `priority`).
 */
export const ExpoImageRendererImageCrop = (): ReactElement => (
  <ImageCrop
    uri="https://example.com/photo.jpg"
    ImageComponent={ExpoImage}
    imageProps={{ cachePolicy: "memory-disk", contentFit: "cover", priority: "high" }}
  />
);

export const ExpoImageRendererImageWithCrop = (): ReactElement => (
  <ImageWithCrop
    uri="https://example.com/photo.jpg"
    cropData={{ scale: 1, translateX: 0, translateY: 0 }}
    ImageComponent={ExpoImage}
    imageProps={{ cachePolicy: "disk", contentFit: "contain", priority: "low" }}
  />
);
