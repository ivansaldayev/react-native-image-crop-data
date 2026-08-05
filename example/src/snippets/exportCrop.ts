// --- snippet:export-manipulator ---
import { ImageManipulator } from "expo-image-manipulator";
import type { CropData } from "../lib";
import { getCropRect, getImageSize } from "../lib";

/**
 * Physically crops `uri` down to `cropData`'s framing, via `expo-image-manipulator`.
 *
 * Measures the source itself. Pass `imageSize` instead when the caller already knows it (an
 * image picker result carries it, for one) — the measurement is a round trip worth skipping.
 */
export const exportCroppedImage = async (
  uri: string,
  aspectRatio: number,
  cropData: CropData,
): Promise<string> => {
  const imageSize = await getImageSize(uri);
  const { x, y, width, height } = getCropRect({ imageSize, aspectRatio, cropData });

  const image = await ImageManipulator.manipulate(uri)
    .crop({ originX: x, originY: y, width, height })
    .renderAsync();
  const { uri: croppedUri } = await image.saveAsync();

  return croppedUri;
};
// --- /snippet:export-manipulator ---
