// --- snippet:expo-image-renderer ---
import type { ReactElement } from "react";
import { Image as ExpoImage } from "expo-image";
import type { CropData } from "../lib";
import { ImageWithCrop } from "../lib";

interface Props {
  uri: string;
  cropData: CropData;
  aspectRatio: number;
}

export const ExpoImageRendererExample = ({ uri, cropData, aspectRatio }: Props): ReactElement => (
  <ImageWithCrop
    uri={uri}
    cropData={cropData}
    aspectRatio={aspectRatio}
    style={{ width: "100%", aspectRatio }}
    ImageComponent={ExpoImage}
    imageProps={{
      cachePolicy: "memory-disk",
      placeholder: { blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4" },
      // Required with this library, not a preference: the crop is applied as a transform scale,
      // so the image is drawn larger than the view expo-image decodes for. Downscaling is on by
      // default, which leaves an enlarged crop visibly soft.
      allowDownscaling: false,
    }}
  />
);
// --- /snippet:expo-image-renderer ---
