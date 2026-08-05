import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { CropData } from "../lib";
import { ImageCrop } from "../lib";

export interface CropRecord {
  uri: string;
  cropData: CropData | null;
}

interface Props {
  record: CropRecord;
  aspectRatio: number;
  onRecordChange: (record: CropRecord) => void;
}

/**
 * Scenario 1: "crop -> data only". Uses `ImageCrop` with no `ImageComponent` prop at all, so
 * this exercises the library's default renderer branch (React Native's own `Image`) at
 * runtime, not only in the type contract.
 */
export const CropDataScreen = ({ record, aspectRatio, onRecordChange }: Props): ReactElement => {
  const [error, setError] = useState<string | null>(null);

  const pickImage = useCallback(async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Media library permission was not granted.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"] });
    if (!result.canceled && result.assets[0]) {
      onRecordChange({ uri: result.assets[0].uri, cropData: null });
    }
  }, [onRecordChange]);

  const handleCropApplied = useCallback(
    (cropData: CropData) => onRecordChange({ ...record, cropData }),
    [record, onRecordChange],
  );

  const handleError = useCallback((cropError: unknown) => {
    setError(cropError instanceof Error ? cropError.message : String(cropError));
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.cropArea}>
        {/*
          No `insets` prop here: this screen is already rendered inside the app's own
          `SafeAreaView` (see `App.tsx`), so the container `ImageCrop` measures via `onLayout`
          already excludes the unsafe area. Passing `insets` on top would subtract it a second
          time (see the prop's own JSDoc) -- `insets` is for consumers who render `ImageCrop`
          edge-to-edge instead.
        */}
        <ImageCrop
          uri={record.uri}
          aspectRatio={aspectRatio}
          cropData={record.cropData ?? undefined}
          onCropApplied={handleCropApplied}
          onError={handleError}
        />
      </View>
      <Pressable style={styles.pickButton} onPress={pickImage}>
        <Text style={styles.pickButtonLabel}>Pick a photo</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.output}>
        <Text style={styles.outputLabel}>CropData (nothing is cut here -- this is only data):</Text>
        <Text style={styles.outputJson}>{JSON.stringify(record.cropData, null, 2)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  cropArea: {
    flex: 1,
  },
  pickButton: {
    margin: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#2F6FED",
  },
  pickButtonLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  error: {
    marginHorizontal: 12,
    color: "#D92C2C",
  },
  output: {
    maxHeight: 140,
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#111827",
    zIndex: 1,
    elevation: 1,
  },
  outputLabel: {
    color: "#D0D5DD",
    fontWeight: "600",
    marginBottom: 4,
  },
  outputJson: {
    color: "#E5E7EB",
    fontFamily: "monospace",
  },
});
