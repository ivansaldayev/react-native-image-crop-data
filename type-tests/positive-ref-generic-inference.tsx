import type { ReactElement } from "react";
import { useRef } from "react";
import { Image as ExpoImage } from "expo-image";
import { ImageCrop, type ImageCropHandle } from "../src/ImageCrop";

/**
 * Case 6 (positive): generic inference of `P` must survive alongside the imperative `ref`
 * (trap T13). `ImageCrop` declares `ref` as an ordinary prop rather than using `forwardRef` —
 * `forwardRef` would return a non-generic component type and destroy inference of `P`. This
 * combines `useRef<ImageCropHandle>` with `ref={...}` on an `ImageCrop` that has `expo-image`
 * injected, so `imageProps` must still be typed exactly for `expo-image`'s props (`cachePolicy`)
 * — if inference had collapsed to the default `P` (RN's `ImageProps`), `cachePolicy` below would
 * fail to type-check.
 *
 * Only `ImageCrop` carries a ref/imperative handle — `ImageWithCrop` has none, so this case does
 * not apply to it.
 */
export const RefWithGenericInference = (): ReactElement => {
  const ref = useRef<ImageCropHandle>(null);

  return (
    <ImageCrop
      uri="https://example.com/photo.jpg"
      ImageComponent={ExpoImage}
      imageProps={{ cachePolicy: "memory-disk" }}
      ref={ref}
    />
  );
};
