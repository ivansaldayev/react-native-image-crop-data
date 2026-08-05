import type { ComponentType, ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageProps, LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { Image, StyleSheet, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { getDisplaySize } from "./core";
import { getImageSize } from "./getImageSize";
import type { CropData, CropImageBaseProps, Size } from "./types";

/**
 * Props for {@link ImageWithCrop}. Generic over `P`, the prop type of the injected
 * `ImageComponent` — defaults to React Native's own `ImageProps` when no renderer is passed.
 */
export interface ImageWithCropProps<P extends CropImageBaseProps = ImageProps> {
  /**
   * The image to display, and — unless {@link ImageWithCropProps.imageSize} is supplied — the
   * image this component measures via `getImageSize`. Only a URI string is accepted;
   * `require()` asset numbers are not (the same limitation `Image.getSize` itself has).
   */
  uri: string;
  /**
   * The non-destructive crop to replay. See `CropData` for the exact semantics of its three
   * fields; it is only valid for the `aspectRatio` it was created with (pass
   * {@link ImageWithCropProps.aspectRatio} to defend that invariant).
   *
   * When omitted, the image renders immediately, filling the container, at the renderer's own
   * default fit — no measurement, no delay.
   */
  cropData?: CropData;
  /**
   * The component used to actually draw the image. Defaults to `Image` from `react-native`.
   *
   * The library owns `style` (geometry) exclusively; every other prop the renderer accepts is
   * passed through {@link ImageWithCropProps.imageProps}, fully typed for whichever component
   * is passed here (e.g. `expo-image`'s `Image`, with its `cachePolicy` / `contentFit`).
   */
  ImageComponent?: ComponentType<P>;
  /**
   * Props forwarded to the rendered image element, typed for whichever `ImageComponent` was
   * passed (or `react-native`'s `Image` by default). Merged over a default `source={{ uri }}`,
   * so passing `source` here overrides the default.
   *
   * `style` is excluded on purpose: geometry is the one thing this library owns, and it must
   * be impossible to override from outside.
   *
   * **If `source` is overridden, its `uri` must be the same image as the `uri` prop above.**
   * `uri` is what this component measures; `imageProps.source` is what actually gets drawn.
   * If the two disagree, the crop geometry is computed for one image while a different one is
   * shown — silently, with no error.
   */
  imageProps?: Omit<P, "style">;
  /**
   * Width / height ratio applied to the container's style (`1` = square, `0.75` = 3:4
   * portrait, `1.7778` = 16:9 — matches CSS `aspect-ratio` and the React Native `aspectRatio`
   * style; **inverted** relative to a height/width convention).
   *
   * `cropData` is only valid for the `aspectRatio` it was created with: showing it inside a
   * container of a different aspect ratio silently produces a wrong (misaligned) picture, and
   * this component has no way to detect that on its own. Pass this prop so the container's
   * aspect ratio always matches the one `cropData` was produced with.
   */
  aspectRatio?: number;
  /**
   * The image's natural pixel size, when already known to the caller. Supplying it skips the
   * asynchronous `getImageSize` measurement entirely, along with the brief delay that
   * measurement otherwise implies.
   */
  imageSize?: Size;
  /**
   * HTTP headers used **only** to measure the image's size, via `Image.getSizeWithHeaders` —
   * for images that require authentication. This does **not** affect how the image is drawn:
   * headers for drawing go separately into `imageProps.source`, because this component cannot
   * type-safely extract them from an unknown renderer's `source` shape. For an authenticated
   * `uri`, either pass headers in both places, or pass {@link ImageWithCropProps.imageSize}
   * and skip measuring here entirely.
   *
   * Pass a stable (e.g. memoized) object — a new object on every render re-triggers
   * measurement.
   */
  headers?: Record<string, string>;
  /**
   * Animated container width, driven from outside this component (e.g. a carousel that
   * resizes it). Must be supplied together with {@link ImageWithCropProps.animatedHeight} —
   * both or neither.
   */
  animatedWidth?: SharedValue<number>;
  /** Animated container height. See {@link ImageWithCropProps.animatedWidth}. */
  animatedHeight?: SharedValue<number>;
  /**
   * Called when measuring the image (via `getImageSize`) fails — a broken URI, a `401`, a
   * missing file. Without this callback the failure would otherwise be an unhandled promise
   * rejection, and the component would silently stay un-cropped forever.
   */
  onError?: (error: unknown) => void;
  /** Style applied to the outer container. */
  style?: StyleProp<ViewStyle>;
  /** Test identifier applied to the outer container. */
  testID?: string;
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  fullSize: {
    width: "100%",
    height: "100%",
  },
});

/**
 * The wrapper geometry (contain-fit size + transform) that reproduces `cropData`'s framing
 * for a given `imageSize` and `containerSize`. Runs on the UI thread: this function is a
 * Reanimated worklet, so it can be called both from a plain render (the static branch) and
 * from `useAnimatedStyle` (the animated branch) — the two branches call this exact same
 * function, so their geometry cannot drift apart.
 */
const getWrapperGeometry = (imageSize: Size, containerSize: Size, cropData: CropData) => {
  "worklet";
  const displaySize = getDisplaySize(imageSize, containerSize);
  const initialScale = Math.max(
    containerSize.width / displaySize.width,
    containerSize.height / displaySize.height,
  );

  return {
    width: displaySize.width,
    height: displaySize.height,
    transform: [
      { translateX: cropData.translateX * containerSize.width },
      { translateY: cropData.translateY * containerSize.height },
      { scale: cropData.scale * initialScale },
    ],
  };
};

/**
 * Non-destructive display of a stored {@link CropData}: replays the exact framing a user saw
 * in a crop editor, without ever touching the source image.
 *
 * Renders nothing but the (measuring) container until both the image size and the container
 * size are known with non-zero sides — this avoids both a flash of the un-cropped frame and a
 * `NaN` transform from a zero-sized measurement. Omitting {@link ImageWithCropProps.cropData}
 * skips cropping entirely: this component just fills the container at the renderer's default
 * fit, immediately.
 */
export const ImageWithCrop = <P extends CropImageBaseProps = ImageProps>(
  props: ImageWithCropProps<P>,
): ReactElement => {
  const {
    uri,
    cropData,
    ImageComponent,
    imageProps,
    aspectRatio,
    imageSize,
    headers,
    animatedWidth,
    animatedHeight,
    onError,
    style,
    testID,
  } = props;

  const hasCropData = Boolean(cropData);
  const hasImageSize = Boolean(imageSize);
  const useAnimatedVersion = Boolean(animatedWidth && animatedHeight);

  // Tagged with the `uri` it was measured for, so a stale measurement from a previous `uri`
  // is never mistaken for the current image's size (out-of-order async completion guard).
  const [measured, setMeasured] = useState<{ uri: string; size: Size } | null>(null);
  const [containerSize, setContainerSize] = useState<Size | null>(null);
  const effectiveImageSize = imageSize ?? (measured?.uri === uri ? measured.size : null);

  // Kept in a ref (rather than a useEffect dependency) so an unmemoized `onError` identity
  // does not re-trigger the measurement effect below on every render.
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!hasCropData || hasImageSize) {
      return;
    }

    let cancelled = false;

    getImageSize(uri, headers ? { headers } : undefined)
      .then((size) => {
        if (!cancelled) {
          setMeasured({ uri, size });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          onErrorRef.current?.(error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [uri, hasCropData, hasImageSize, headers]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);

  const animatedWrapperStyle = useAnimatedStyle(() => {
    "worklet";
    if (!animatedWidth || !animatedHeight || !cropData || !effectiveImageSize) {
      return {};
    }

    const containerWidth = animatedWidth.value;
    const containerHeight = animatedHeight.value;

    if (!containerWidth || !containerHeight || !effectiveImageSize.width || !effectiveImageSize.height) {
      return {};
    }

    return getWrapperGeometry(effectiveImageSize, { width: containerWidth, height: containerHeight }, cropData);
  }, [animatedWidth, animatedHeight, cropData, effectiveImageSize]);

  const Renderer = ImageComponent ?? Image;
  const rendererProps = {
    source: { uri },
    ...imageProps,
    style: styles.fullSize,
    // Omit<P, "style"> & { source; style } cannot be proven assignable to P (TS2769 without this cast).
  } as unknown as P;

  const containerStyle = [styles.container, aspectRatio ? { aspectRatio } : undefined, style];

  if (!cropData) {
    return (
      <View style={containerStyle} testID={testID}>
        <Renderer {...rendererProps} />
      </View>
    );
  }

  if (!effectiveImageSize || !effectiveImageSize.width || !effectiveImageSize.height) {
    return <View style={containerStyle} onLayout={useAnimatedVersion ? undefined : handleLayout} testID={testID} />;
  }

  if (useAnimatedVersion) {
    return (
      <View style={containerStyle} testID={testID}>
        <Animated.View style={animatedWrapperStyle}>
          <Renderer {...rendererProps} />
        </Animated.View>
      </View>
    );
  }

  if (!containerSize || !containerSize.width || !containerSize.height) {
    return <View style={containerStyle} onLayout={handleLayout} testID={testID} />;
  }

  const wrapperStyle = getWrapperGeometry(effectiveImageSize, containerSize, cropData);

  return (
    <View style={containerStyle} onLayout={handleLayout} testID={testID}>
      <Animated.View style={wrapperStyle}>
        <Renderer {...rendererProps} />
      </Animated.View>
    </View>
  );
};
