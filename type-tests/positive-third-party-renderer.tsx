import type { ReactElement } from "react";
import type { StyleProp, ImageStyle } from "react-native";
import { Text } from "react-native";
import { ImageCrop } from "../src/ImageCrop";
import { ImageWithCrop } from "../src/ImageWithCrop";

/**
 * Case 5 (positive): an arbitrary third-party functional component, unrelated to `react-native`
 * or `expo-image`, with its own bespoke props. Proves the contract is a genuine structural
 * constraint on `style` alone, not something tailored to the two renderers used elsewhere in
 * this suite.
 */
interface ThirdPartyRendererProps {
  style?: StyleProp<ImageStyle>;
  label: string;
  rounded?: boolean;
}

const ThirdPartyRenderer = ({ style, label, rounded }: ThirdPartyRendererProps): ReactElement => (
  <Text style={rounded ? [style] : style}>{label}</Text>
);

export const ThirdPartyRendererImageCrop = (): ReactElement => (
  <ImageCrop
    uri="https://example.com/photo.jpg"
    ImageComponent={ThirdPartyRenderer}
    imageProps={{ label: "custom renderer", rounded: true }}
  />
);

export const ThirdPartyRendererImageWithCrop = (): ReactElement => (
  <ImageWithCrop
    uri="https://example.com/photo.jpg"
    cropData={{ scale: 1, translateX: 0, translateY: 0 }}
    ImageComponent={ThirdPartyRenderer}
    imageProps={{ label: "custom renderer", rounded: false }}
  />
);
