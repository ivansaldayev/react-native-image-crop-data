import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { exportCroppedImage } from "../snippets/exportCrop";
import type { CropRecord } from "./CropDataScreen";

interface Props {
  record: CropRecord;
  aspectRatio: number;
}

/**
 * Scenario 3: explicit export. `getCropRect()` -> real cropping via
 * `expo-image-manipulator` (see `../snippets/exportCrop.ts`, the README's export recipe,
 * executed here rather than merely described). The original is shown alongside the result so
 * it is visibly undegraded -- the source file itself is only ever touched by this button.
 */
export const ExportScreen = ({ record, aspectRatio }: Props): ReactElement => {
  const [exportedUri, setExportedUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (!record.cropData) {
      setError("Apply a crop on the first screen before exporting.");
      return;
    }

    setError(null);
    setIsExporting(true);
    try {
      const uri = await exportCroppedImage(record.uri, aspectRatio, record.cropData);
      setExportedUri(uri);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : String(exportError));
    } finally {
      setIsExporting(false);
    }
  }, [record, aspectRatio]);

  return (
    <View style={styles.root}>
      <Pressable style={styles.exportButton} onPress={handleExport} disabled={isExporting}>
        <Text style={styles.exportButtonLabel}>{isExporting ? "Exporting..." : "Export (physically crop)"}</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.row}>
        <View style={styles.column}>
          <Text style={styles.columnLabel}>Original (undegraded)</Text>
          <Image source={{ uri: record.uri }} style={styles.thumb} resizeMode="contain" />
        </View>
        <View style={styles.column}>
          <Text style={styles.columnLabel}>Exported crop</Text>
          {exportedUri ? (
            <Image source={{ uri: exportedUri }} style={styles.thumb} resizeMode="contain" />
          ) : (
            <Text style={styles.placeholder}>Not exported yet</Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 12,
  },
  exportButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#2F6FED",
    marginBottom: 12,
  },
  exportButtonLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  error: {
    color: "#D92C2C",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  column: {
    flex: 1,
  },
  columnLabel: {
    fontWeight: "600",
    marginBottom: 8,
  },
  thumb: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#111111",
  },
  placeholder: {
    color: "#6B7280",
  },
});
