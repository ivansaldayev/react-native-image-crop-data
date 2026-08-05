import type { ReactElement } from "react";
import { StyleSheet, View } from "react-native";
import type { CropRect } from "./types";

const DEFAULT_OVERLAY_COLOR = "rgba(0, 0, 0, 0.4)";
const DEFAULT_BORDER_COLOR = "#FFFFFF";
const DEFAULT_BORDER_WIDTH = 1;

export interface CropOverlayProps {
  /** Crop window rect in the coordinate space of the parent view. */
  rect: CropRect;
  /**
   * Colour of the four dimmed bands surrounding the crop window.
   *
   * @default "rgba(0, 0, 0, 0.4)"
   */
  overlayColor?: string;
  /**
   * Colour of the crop window's border.
   *
   * @default "#FFFFFF"
   */
  borderColor?: string;
  /**
   * Width of the crop window's border, in pixels.
   *
   * @default 1
   */
  borderWidth?: number;
}

/**
 * Dims everything around `rect`, leaving a clear rectangular "window" over it.
 *
 * The window is not a shape of its own — it is simply the area none of the four surrounding
 * bands cover, so it always matches `rect` exactly. The bands never overlap, which matters
 * because `overlayColor` is semi-transparent by default and a double-covered corner would look
 * visibly darker than the edges:
 *
 * - the top and bottom bands span the full width;
 * - the left and right bands are confined to the rows between them (`rect.y` to
 *   `rect.y + rect.height`), so they never reach into the top or bottom band.
 *
 * Every pair of adjacent edges (band-to-band, band-to-window) is written as the same expression
 * on both sides (`rect.y`, `rect.y + rect.height`, `rect.x`, `rect.x + rect.width`) instead of an
 * equivalent-but-differently-derived number, so React Native's layout rounding snaps them to the
 * same device pixel.
 *
 * `pointerEvents="none"` on the root view lets pinch/pan gestures underneath keep working —
 * without it, this overlay would silently swallow every touch.
 */
export const CropOverlay = ({
  rect,
  overlayColor = DEFAULT_OVERLAY_COLOR,
  borderColor = DEFAULT_BORDER_COLOR,
  borderWidth = DEFAULT_BORDER_WIDTH,
}: CropOverlayProps): ReactElement => {
  const { x, y, width, height } = rect;
  const windowRight = x + width;
  const windowBottom = y + height;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View
        style={[styles.dimBand, { top: 0, left: 0, right: 0, height: y, backgroundColor: overlayColor }]}
      />
      <View
        style={[
          styles.dimBand,
          { top: windowBottom, left: 0, right: 0, bottom: 0, backgroundColor: overlayColor },
        ]}
      />
      <View
        style={[styles.dimBand, { top: y, left: 0, width: x, height, backgroundColor: overlayColor }]}
      />
      <View
        style={[
          styles.dimBand,
          { top: y, left: windowRight, right: 0, height, backgroundColor: overlayColor },
        ]}
      />
      <View style={[styles.window, { left: x, top: y, width, height, borderColor, borderWidth }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  dimBand: {
    position: "absolute",
  },
  window: {
    position: "absolute",
  },
});
