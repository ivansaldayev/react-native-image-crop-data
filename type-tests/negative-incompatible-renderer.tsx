import type { ReactElement } from "react";
import { Text } from "react-native";
import { ImageCrop } from "../src/ImageCrop";
import { ImageWithCrop } from "../src/ImageWithCrop";

/**
 * Case 9 (negative): a component that does not accept the `style` value the library computes
 * must be rejected as an `ImageComponent`. `IncompatibleStyleRenderer` types its own `style` as
 * a plain `string` (e.g. a CSS class name, as some non-RN-native component might use), which is
 * not assignable from `StyleProp<ImageStyle>` — this must fail the `CropImageBaseProps`
 * constraint on both components.
 *
 * Deliberately has no props besides `style`: adding an unrelated required prop here changed
 * *which* type error TypeScript reports (about the missing unrelated prop instead of about
 * `style`) once generic inference falls back to the constraint type — confirmed by direct
 * experimentation while writing this suite. Keeping the component minimal keeps the reported
 * error on `style`, which is the property this case exists to test.
 */
interface IncompatibleStyleRendererProps {
  style?: string;
}

const IncompatibleStyleRenderer = (_props: IncompatibleStyleRendererProps): ReactElement => <Text>rendered</Text>;

export const IncompatibleRendererImageCrop = (): ReactElement => (
  // @ts-expect-error - `IncompatibleStyleRenderer`'s `style` is `string`, not assignable from `StyleProp<ImageStyle>`
  <ImageCrop uri="https://example.com/photo.jpg" ImageComponent={IncompatibleStyleRenderer} />
);

export const IncompatibleRendererImageWithCrop = (): ReactElement => (
  <ImageWithCrop
    uri="https://example.com/photo.jpg"
    cropData={{ scale: 1, translateX: 0, translateY: 0 }}
    // @ts-expect-error - `IncompatibleStyleRenderer`'s `style` is `string`, not assignable from `StyleProp<ImageStyle>`
    ImageComponent={IncompatibleStyleRenderer}
  />
);
