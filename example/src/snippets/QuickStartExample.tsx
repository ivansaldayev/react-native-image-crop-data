// --- snippet:quick-start ---
import { useState } from "react";
import type { ReactElement } from "react";
import { Text, View } from "react-native";
import type { CropData } from "../lib";
import { ImageCrop } from "../lib";

const SAMPLE_IMAGE_URI = "https://picsum.photos/id/1025/1600/1200";

export const QuickStartExample = (): ReactElement => {
  const [cropData, setCropData] = useState<CropData | null>(null);

  return (
    <View style={{ flex: 1 }}>
      <ImageCrop uri={SAMPLE_IMAGE_URI} aspectRatio={0.75} onCropApplied={setCropData} />
      <Text>{JSON.stringify(cropData)}</Text>
    </View>
  );
};
// --- /snippet:quick-start ---
