import type { ComponentType, ReactElement, ReactNode, Ref } from "react";
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { ImageProps, LayoutChangeEvent, StyleProp, ViewStyle } from "react-native";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { CropOverlay } from "./CropOverlay";
import { clamp, getCropWindowSize, getDisplaySize, getMaxScale } from "./core";
import { getImageSize } from "./getImageSize";
import type { CropData, CropImageBaseProps, CropRect, Size } from "./types";
import { IDENTITY_CROP } from "./types";

const DEFAULT_ASPECT_RATIO = 1;
const DEFAULT_CROP_PADDING = 8;
const DEFAULT_MAX_SCALE = 20;
const DEFAULT_SUBMIT_LABEL = "Apply";
const DEFAULT_BACKGROUND_COLOR = "#000000";
const FOOTER_BOTTOM_GAP = 16;
const FOOTER_HORIZONTAL_PADDING = 20;

/**
 * Imperative handle exposed via `ImageCrop`'s `ref` prop.
 */
export interface ImageCropHandle {
  /**
   * Reads the current crop as a {@link CropData}.
   *
   * Returns `null` until both the image size and the container size are known (see the
   * `imageSize`/`containerSize` props and `onImageSize`/`onError`).
   *
   * Reads shared values synchronously from the JS thread. Call this outside an active pinch
   * or pan gesture — during a gesture the underlying values may briefly lag what is on
   * screen, since the gesture updates them on the UI thread.
   */
  getCropData(): CropData | null;
  /** Resets the crop to the identity position for the current `aspectRatio` (no zoom beyond covering the crop window, centred). */
  reset(): void;
}

/**
 * Props of {@link ImageCrop}.
 *
 * Generic over `P`, the props of the injected `ImageComponent` (defaults to `ImageProps` from
 * `react-native`). `imageProps` is typed as exactly `P`'s props (minus `style`), so IDE
 * autocomplete and type errors reflect the renderer actually passed in.
 */
export interface ImageCropProps<P extends CropImageBaseProps = ImageProps> {
  /**
   * URI of the image to crop. Used both to measure the image's natural size and, by default,
   * as the renderer's `source={{ uri }}`.
   *
   * Only URI strings are supported — `require()` asset numbers are not, since the underlying
   * measurement (`Image.getSize`) does not accept them.
   *
   * This measurement call has no `headers` option, so it cannot measure an image that requires
   * authentication (unlike `ImageWithCrop`'s `headers` prop). For a protected `uri`, supply
   * {@link ImageCropProps.imageSize} directly instead and skip the measurement entirely.
   */
  uri: string;
  /**
   * Component used to render the image pixels. Defaults to `Image` from `react-native`.
   *
   * The library owns geometry (size and transform) exclusively; anything else the renderer
   * needs — `source`, headers, caching, placeholders, fit mode — goes through `imageProps`.
   */
  ImageComponent?: ComponentType<P>;
  /**
   * Props forwarded to `ImageComponent`, typed as exactly what the renderer accepts (minus
   * `style`, which the library always computes itself).
   *
   * Merged **over** the library's default `source={{ uri }}`, so a consumer can override
   * `source` (e.g. to add auth headers). When doing so, `source`'s own URI must refer to the
   * same image as the `uri` prop — the library measures `uri`, not whatever `imageProps.source`
   * points to, so a mismatch measures one image and displays another, with no error.
   *
   * The library never sets a fit mode (`resizeMode` / `contentFit`): it renders the image at
   * exactly its contain-fit display size, where every fit mode agrees. A consumer may still
   * pass one through `imageProps` harmlessly.
   */
  imageProps?: Omit<P, "style">;
  /**
   * Target width / height ratio of the crop window. `1` = square, `0.75` = 3:4 portrait,
   * `1.7778` = 16:9. Matches CSS `aspect-ratio`.
   *
   * If you already have ratios expressed as height / width (a common alternative convention —
   * e.g. a portrait ratio written as `4/3`), convert with `1 / oldRatio` before passing them
   * here.
   *
   * @default 1
   */
  aspectRatio?: number;
  /**
   * Initial crop to seed the editor with (e.g. to let a user re-edit a previously saved crop).
   *
   * This is a **seed, not a controlled value**: after the gesture starts, the component owns
   * the live crop internally. Changing this prop's value later re-seeds the crop again.
   *
   * Only valid for the `aspectRatio` it was produced with — see {@link CropData}.
   */
  cropData?: CropData;
  /**
   * Natural size of the image, in pixels. When supplied, the asynchronous measurement via
   * `Image.getSize` is skipped entirely and the crop becomes usable immediately.
   */
  imageSize?: Size;
  /**
   * Overrides the container size that would otherwise be measured from the root view's
   * `onLayout`.
   */
  containerSize?: Size;
  /**
   * Inset of the crop window from the container, in pixels, applied on **each** side.
   *
   * @default 8
   */
  cropPadding?: number;
  /**
   * Maximum zoom, as a multiplier of "the image exactly covers the crop window" — the same
   * unit as {@link CropData}'s `scale`, since `CropData.scale` is exactly `rawScale /
   * initialScale`. A value below `1` is treated as `1`: covering the crop window always wins,
   * so the pinch gesture can never zoom out far enough to leave gaps at the window's edges.
   *
   * @default 20
   */
  maxScale?: number;
  /**
   * Background colour behind the image, filling the whole component.
   *
   * @default "#000000"
   */
  backgroundColor?: string;
  /**
   * Colour of the dimmed area outside the crop window. Passed straight through to the
   * built-in {@link CropOverlay} (which owns the actual default); ignored when `renderOverlay`
   * is supplied.
   */
  overlayColor?: string;
  /**
   * Colour of the crop window's border. Passed straight through to the built-in
   * {@link CropOverlay} (which owns the actual default); ignored when `renderOverlay` is
   * supplied.
   */
  borderColor?: string;
  /**
   * Width of the crop window's border, in pixels. Passed straight through to the built-in
   * {@link CropOverlay} (which owns the actual default); ignored when `renderOverlay` is
   * supplied.
   */
  borderWidth?: number;
  /**
   * Replaces the built-in crop-window overlay entirely. `rect` is the crop window's
   * `{ x, y, width, height }`, in the same coordinate space as the component's own root —
   * safe to use directly for an absolutely positioned sibling, as long as nothing shifts the
   * measured root and this render output out of alignment.
   */
  renderOverlay?: (rect: CropRect) => ReactNode;
  /**
   * Replaces the built-in bottom panel entirely. Receives `apply` (calls `onCropApplied` with
   * the current crop) and `canApply` (whether the crop is ready to be read, i.e. image and
   * container size are both known).
   *
   * Only rendered — built-in or via this prop — when `onCropApplied` is supplied.
   */
  renderFooter?: (api: { apply: () => void; canApply: boolean }) => ReactNode;
  /**
   * Label of the built-in submit button. Ignored when `renderFooter` is supplied. Localizing
   * this text is the consumer's responsibility.
   *
   * @default "Apply"
   */
  submitLabel?: string;
  /**
   * Bottom safe-area inset for the **built-in** submit button, supplied by the consumer (e.g.
   * from `react-native-safe-area-context`, which is not a dependency of this library). It keeps
   * that button clear of the home indicator / gesture bar.
   *
   * Not applied when {@link ImageCropProps.renderFooter} is used — a custom footer owns its own
   * spacing.
   *
   * This does **not** affect crop geometry. The crop window is derived from the container's
   * actual measured size, so if you have already placed this component inside a safe area, the
   * layout has accounted for it and the library must not subtract it a second time.
   *
   * An object rather than a flat `bottomInset` so further edges can be added later without a
   * breaking change.
   *
   * @default {}
   */
  insets?: { bottom?: number };
  /**
   * Called when the user applies the crop, via the built-in button or a custom
   * `renderFooter`'s `apply()`. The built-in footer is only rendered when this prop is
   * supplied.
   */
  onCropApplied?: (cropData: CropData) => void;
  /**
   * Called whenever the crop changes, at the end of a pinch or pan gesture (never on every
   * gesture frame).
   */
  onCropChange?: (cropData: CropData) => void;
  /** Called once the image's natural size has been measured (not called when `imageSize` is supplied directly — the caller already knows it in that case). */
  onImageSize?: (size: Size) => void;
  /** Called when measuring the image (via `Image.getSize` / `getSizeWithHeaders`) fails, instead of an unhandled promise rejection. */
  onError?: (error: unknown) => void;
  /** Style applied to the root view. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Imperative handle — see {@link ImageCropHandle}. */
  ref?: Ref<ImageCropHandle>;
}

interface Geometry {
  displaySize: Size;
  cropWindowSize: Size;
  cropWindowRect: CropRect;
  initialScale: number;
}

/**
 * Gesture-driven crop editor: pinch to zoom, pan to reposition, inside a fixed-aspect crop
 * window. Produces a {@link CropData} — a normalised, resolution-independent description of
 * the crop — rather than a cropped file; physically cutting pixels is a separate, explicit
 * step (see `getCropRect`).
 */
export const ImageCrop = <P extends CropImageBaseProps = ImageProps>({
  uri,
  ImageComponent,
  imageProps,
  aspectRatio = DEFAULT_ASPECT_RATIO,
  cropData,
  imageSize: imageSizeProp,
  containerSize: containerSizeProp,
  cropPadding = DEFAULT_CROP_PADDING,
  maxScale = DEFAULT_MAX_SCALE,
  backgroundColor = DEFAULT_BACKGROUND_COLOR,
  overlayColor,
  borderColor,
  borderWidth,
  renderOverlay,
  renderFooter,
  submitLabel = DEFAULT_SUBMIT_LABEL,
  insets = {},
  onCropApplied,
  onCropChange,
  onImageSize,
  onError,
  style,
  testID,
  ref,
}: ImageCropProps<P>): ReactElement => {
  const Renderer = ImageComponent ?? Image;

  const [measuredContainerSize, setMeasuredContainerSize] = useState<Size | null>(null);
  const [measuredImageSize, setMeasuredImageSize] = useState<Size | null>(null);

  const containerSize = containerSizeProp ?? measuredContainerSize;
  const imageSize = imageSizeProp ?? measuredImageSize;

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setMeasuredContainerSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  }, []);

  // Latest callbacks are read through refs so the measurement effect below only re-runs when
  // `uri`/`imageSizeProp` actually change, not on every render where the consumer passes a
  // fresh inline `onImageSize`/`onError`.
  const onImageSizeRef = useRef(onImageSize);
  onImageSizeRef.current = onImageSize;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    setMeasuredImageSize(null);
  }, [uri]);

  useEffect(() => {
    if (imageSizeProp) return;

    let cancelled = false;
    getImageSize(uri)
      .then((size) => {
        if (cancelled) return;
        setMeasuredImageSize(size);
        onImageSizeRef.current?.(size);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onErrorRef.current?.(error);
      });

    return () => {
      cancelled = true;
    };
  }, [uri, imageSizeProp]);

  // Nothing below is computed — and no transform is applied — until both sizes are known and
  // non-zero: a zero side turns a display/window ratio into `NaN`, and the image would vanish
  // with no error.
  const geometry = useMemo<Geometry | null>(() => {
    if (!containerSize || !imageSize) return null;
    if (containerSize.width <= 0 || containerSize.height <= 0) return null;
    if (imageSize.width <= 0 || imageSize.height <= 0) return null;

    const displaySize = getDisplaySize(imageSize, containerSize);
    const cropWindowSize = getCropWindowSize(containerSize, aspectRatio, cropPadding);
    const initialScale = Math.max(cropWindowSize.width / displaySize.width, cropWindowSize.height / displaySize.height);
    const cropWindowRect: CropRect = {
      x: (containerSize.width - cropWindowSize.width) / 2,
      y: (containerSize.height - cropWindowSize.height) / 2,
      width: cropWindowSize.width,
      height: cropWindowSize.height,
    };

    return { displaySize, cropWindowSize, initialScale, cropWindowRect };
  }, [containerSize, imageSize, aspectRatio, cropPadding]);

  const scale = useSharedValue(1);
  const lastScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  // Finger translation already folded into `translateX`/`translateY` during the current pan
  // gesture, in screen pixels. Pan updates must be incremental — each event's delta converted
  // at the scale current at that moment. Re-converting the gesture's whole accumulated
  // translation at the current scale (the previous approach) leaves that translation constant
  // in screen pixels while a simultaneous pinch rescales everything else, which drags the
  // pinch anchor away from the crop-window centre by exactly the panned distance.
  const prevPanTranslationX = useSharedValue(0);
  const prevPanTranslationY = useSharedValue(0);

  // Seeds from an incoming `cropData`, and re-seeds whenever it (or the geometry it depends
  // on) changes, so a later `cropData` update or a container/image resize both reapply the
  // seed.
  useEffect(() => {
    if (!geometry || !cropData) return;

    const absoluteScale = cropData.scale * geometry.initialScale;
    const nextTranslateX = (cropData.translateX * geometry.cropWindowSize.width) / absoluteScale;
    const nextTranslateY = (cropData.translateY * geometry.cropWindowSize.height) / absoluteScale;

    scale.value = absoluteScale;
    lastScale.value = absoluteScale;
    translateX.value = nextTranslateX;
    translateY.value = nextTranslateY;
  }, [geometry, cropData, scale, lastScale, translateX, translateY]);

  // Without a `cropData` seed, the identity crop is applied exactly once per `uri` — not again
  // on a later container resize (e.g. an orientation change), which would otherwise discard an
  // in-progress pan or pinch gesture.
  const hasSeededIdentityRef = useRef(false);
  useEffect(() => {
    hasSeededIdentityRef.current = false;
  }, [uri]);

  useEffect(() => {
    if (!geometry || cropData || hasSeededIdentityRef.current) return;

    const absoluteScale = IDENTITY_CROP.scale * geometry.initialScale;
    const nextTranslateX = (IDENTITY_CROP.translateX * geometry.cropWindowSize.width) / absoluteScale;
    const nextTranslateY = (IDENTITY_CROP.translateY * geometry.cropWindowSize.height) / absoluteScale;

    scale.value = absoluteScale;
    lastScale.value = absoluteScale;
    translateX.value = nextTranslateX;
    translateY.value = nextTranslateY;
    hasSeededIdentityRef.current = true;
  }, [geometry, cropData, scale, lastScale, translateX, translateY]);

  const getCropData = useCallback((): CropData | null => {
    if (!geometry) return null;

    const rawScale = scale.value;
    return {
      scale: rawScale / geometry.initialScale,
      translateX: (translateX.value * rawScale) / geometry.cropWindowSize.width,
      translateY: (translateY.value * rawScale) / geometry.cropWindowSize.height,
    };
  }, [geometry, scale, translateX, translateY]);

  useImperativeHandle(
    ref,
    () => ({
      getCropData,
      reset: () => {
        if (!geometry) return;
        scale.value = geometry.initialScale;
        lastScale.value = geometry.initialScale;
        translateX.value = 0;
        translateY.value = 0;
      },
    }),
    [getCropData, geometry, scale, lastScale, translateX, translateY],
  );

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      lastScale.value = scale.value;
    })
    .onUpdate((e) => {
      if (!geometry || e.numberOfPointers !== 2) return;
      scale.value = clamp(lastScale.value * e.scale, geometry.initialScale, getMaxScale(geometry.initialScale, maxScale));
    })
    .onEnd(() => {
      lastScale.value = scale.value;
      if (!geometry || !onCropChange) return;

      const rawScale = scale.value;
      const nextCropData: CropData = {
        scale: rawScale / geometry.initialScale,
        translateX: (translateX.value * rawScale) / geometry.cropWindowSize.width,
        translateY: (translateY.value * rawScale) / geometry.cropWindowSize.height,
      };
      runOnJS(onCropChange)(nextCropData);
    });

  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .onBegin(() => {
      prevPanTranslationX.value = 0;
      prevPanTranslationY.value = 0;
    })
    .onUpdate((e) => {
      if (!geometry) return;

      const safeScale = scale.value || 1;
      const scaledImageWidth = geometry.displaySize.width * safeScale;
      const scaledImageHeight = geometry.displaySize.height * safeScale;

      const maxActualX = Math.max(0, (scaledImageWidth - geometry.cropWindowSize.width) / 2);
      const maxActualY = Math.max(0, (scaledImageHeight - geometry.cropWindowSize.height) / 2);

      const nextTranslateX = translateX.value + (e.translationX - prevPanTranslationX.value) / safeScale;
      const nextTranslateY = translateY.value + (e.translationY - prevPanTranslationY.value) / safeScale;
      prevPanTranslationX.value = e.translationX;
      prevPanTranslationY.value = e.translationY;

      const maxNormalizedX = maxActualX / safeScale;
      const maxNormalizedY = maxActualY / safeScale;

      translateX.value = clamp(nextTranslateX, -maxNormalizedX, maxNormalizedX);
      translateY.value = clamp(nextTranslateY, -maxNormalizedY, maxNormalizedY);
    })
    .onEnd(() => {
      if (!geometry || !onCropChange) return;

      const rawScale = scale.value;
      const nextCropData: CropData = {
        scale: rawScale / geometry.initialScale,
        translateX: (translateX.value * rawScale) / geometry.cropWindowSize.width,
        translateY: (translateY.value * rawScale) / geometry.cropWindowSize.height,
      };
      runOnJS(onCropChange)(nextCropData);
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value * scale.value }, { translateY: translateY.value * scale.value }, { scale: scale.value }],
  }));

  const renderImageElement = (displaySize: Size): ReactElement => {
    // `Omit<P, "style"> & { style }` cannot be proven to satisfy `P` by structural typing
    // alone (TS2769 without this assertion) — the one cast the renderer-injection contract
    // requires. `source` is a separate, earlier JSX attribute so `imageProps.source`, if
    // given, overrides the default; `style` is spread last within `mergedProps` so it always
    // wins over anything `imageProps` could (structurally cannot, but just in case) contain.
    const mergedProps = { ...imageProps, style: { width: displaySize.width, height: displaySize.height } } as P;
    return <Renderer source={{ uri }} {...mergedProps} />;
  };

  const canApply = geometry !== null;

  const applyCrop = useCallback(() => {
    const data = getCropData();
    if (data) onCropApplied?.(data);
  }, [getCropData, onCropApplied]);

  let footerElement: ReactNode = null;
  if (onCropApplied) {
    footerElement = renderFooter ? (
      renderFooter({ apply: applyCrop, canApply })
    ) : (
      <View style={[styles.footer, { bottom: (insets.bottom ?? 0) + FOOTER_BOTTOM_GAP }]}>
        <Pressable
          onPress={applyCrop}
          disabled={!canApply}
          style={[styles.submitButton, !canApply && styles.submitButtonDisabled]}
        >
          <Text style={styles.submitLabel}>{submitLabel}</Text>
        </Pressable>
      </View>
    );
  }

  const overlayElement = geometry
    ? renderOverlay
      ? renderOverlay(geometry.cropWindowRect)
      : <CropOverlay rect={geometry.cropWindowRect} overlayColor={overlayColor} borderColor={borderColor} borderWidth={borderWidth} />
    : null;

  return (
    <View style={[styles.root, { backgroundColor }, style]} onLayout={handleLayout} testID={testID}>
      <GestureDetector gesture={composedGesture}>
        <View style={styles.cropArea}>
          {geometry && (
            <Animated.View style={[styles.transformLayer, animatedStyle]}>{renderImageElement(geometry.displaySize)}</Animated.View>
          )}
        </View>
      </GestureDetector>
      {overlayElement}
      {footerElement}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    // The image is scaled past the container by design, and Android does not clip child views:
    // without this it draws over whatever sits next to the editor and swallows touches there.
    overflow: "hidden",
  },
  cropArea: {
    flex: 1,
  },
  transformLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: FOOTER_HORIZONTAL_PADDING,
    alignItems: "center",
  },
  submitButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitLabel: {
    color: "#000000",
    fontWeight: "600",
  },
});
