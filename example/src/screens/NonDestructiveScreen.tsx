import type { ReactElement } from "react";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { CropData } from "../lib";
import { IDENTITY_CROP } from "../lib";
import { ImageWithCrop } from "../lib";
import { ExpoImageRendererExample } from "../snippets/ExpoImageRendererExample";
import type { CropRecord } from "./CropDataScreen";

const ASPECT_RATIOS: { label: string; value: number }[] = [
  { label: "1:1", value: 1 },
  { label: "3:4", value: 0.75 },
  { label: "16:9", value: 1.7778 },
];

// A fixed demo token: there is no real authenticated endpoint in this example, this only
// demonstrates the correct pairing required by the library's `imageProps`/`headers` contract
// (T14): `imageProps.source.uri` always equals the `uri` prop below, even though headers for
// measuring (`headers`) and for drawing (`imageProps.source.headers`) are declared separately.
const DEMO_AUTH_HEADERS = { Authorization: "Bearer demo-token" };

interface Props {
  record: CropRecord;
  aspectRatio: number;
  onAspectRatioChange: (aspectRatio: number) => void;
  onRecordChange: (record: CropRecord) => void;
  onEdit: () => void;
}

/**
 * Scenario 2: non-destructive display. The same source is shown through `ImageWithCrop` with
 * the saved `CropData`; "Edit crop" reopens the crop editor (scenario 1's screen) seeded with
 * that same `cropData`; the aspect-ratio switcher shows the `CropData` being recreated for the
 * new aspect ratio while `record.uri` -- the actual file -- is never touched.
 */
export const NonDestructiveScreen = ({ record, aspectRatio, onAspectRatioChange, onRecordChange, onEdit }: Props): ReactElement => {
  const handleAspectRatioChange = useCallback(
    (value: number) => {
      if (value === aspectRatio) return;
      onAspectRatioChange(value);
      // `CropData` recorded for the previous aspect ratio is not valid for this one (see the
      // `CropData` invariant) -- recreate it as the identity crop for the new ratio. Only the
      // in-memory record changes; `record.uri` (the source file) is untouched.
      onRecordChange({ ...record, cropData: IDENTITY_CROP });
    },
    [aspectRatio, record, onAspectRatioChange, onRecordChange],
  );

  const cropData = record.cropData ?? IDENTITY_CROP;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.ratioRow}>
        {ASPECT_RATIOS.map((ratio) => (
          <Pressable
            key={ratio.label}
            onPress={() => handleAspectRatioChange(ratio.value)}
            style={[styles.ratioButton, ratio.value === aspectRatio && styles.ratioButtonActive]}
          >
            <Text style={styles.ratioLabel}>{ratio.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Preview (rendered with expo-image, cachePolicy + placeholder):</Text>
      <ExpoImageRendererExample uri={record.uri} cropData={cropData} aspectRatio={aspectRatio} />

      <Pressable style={styles.editButton} onPress={onEdit}>
        <Text style={styles.editButtonLabel}>Edit crop</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>CropData (recreated on aspect-ratio change, file untouched):</Text>
      <Text style={styles.outputJson}>{JSON.stringify(cropData, null, 2)}</Text>

      <Text style={styles.sectionLabel}>
        Authenticated-source demo: measurement headers (`headers`) and drawing headers
        (`imageProps.source.headers`) are declared separately, but `imageProps.source.uri`
        matches the `uri` prop -- diverging the two would measure one image and silently show
        another.
      </Text>
      <ImageWithCrop
        uri={record.uri}
        headers={DEMO_AUTH_HEADERS}
        cropData={cropData}
        aspectRatio={aspectRatio}
        style={styles.authPreview}
        imageProps={{ source: { uri: record.uri, headers: DEMO_AUTH_HEADERS } }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: 12,
  },
  ratioRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  ratioButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#E4E7EC",
  },
  ratioButtonActive: {
    backgroundColor: "#2F6FED",
  },
  ratioLabel: {
    fontWeight: "600",
  },
  sectionLabel: {
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  editButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#2F6FED",
  },
  editButtonLabel: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  outputJson: {
    fontFamily: "monospace",
  },
  authPreview: {
    width: "100%",
  },
});
