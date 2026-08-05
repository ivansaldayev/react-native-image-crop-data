import type { ReactElement } from "react";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { CropRecord } from "./src/screens/CropDataScreen";
import { CropDataScreen } from "./src/screens/CropDataScreen";
import { ExportScreen } from "./src/screens/ExportScreen";
import { NonDestructiveScreen } from "./src/screens/NonDestructiveScreen";
import { QuickStartScreen } from "./src/screens/QuickStartScreen";
import { SAMPLE_IMAGE_URI } from "./src/sampleImage";

type TabKey = "crop" | "preview" | "export" | "quickstart";

const TABS: { key: TabKey; label: string }[] = [
  { key: "crop", label: "1. Crop" },
  { key: "preview", label: "2. Preview" },
  { key: "export", label: "3. Export" },
  { key: "quickstart", label: "Quick start" },
];

// `GestureHandlerRootView` must wrap the whole app root -- without it, `react-native-gesture-
// handler`'s gestures silently never fire (no error at all).
//
// Insets come from `react-native-safe-area-context`, not from React Native's own `SafeAreaView`:
// the latter is a no-op on Android, and Expo SDK 54 draws edge-to-edge unconditionally, so the
// tab bar would sit under the status bar and the bottom row under the navigation bar.
export default function App(): ReactElement {
  const [tab, setTab] = useState<TabKey>("crop");
  const [record, setRecord] = useState<CropRecord>({ uri: SAMPLE_IMAGE_URI, cropData: null });
  const [aspectRatio, setAspectRatio] = useState(1);

  const handleEdit = useCallback(() => setTab("crop"), []);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.flex}>
          <StatusBar style="auto" />
          <View style={styles.tabBar}>
            {TABS.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[styles.tab, tab === t.key && styles.tabActive]}
              >
                <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          {tab === "crop" && <CropDataScreen record={record} aspectRatio={aspectRatio} onRecordChange={setRecord} />}
          {tab === "preview" && (
            <NonDestructiveScreen
              record={record}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              onRecordChange={setRecord}
              onEdit={handleEdit}
            />
          )}
          {tab === "export" && <ExportScreen record={record} aspectRatio={aspectRatio} />}
          {tab === "quickstart" && <QuickStartScreen />}
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D0D5DD",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#2F6FED",
  },
  tabLabel: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "600",
  },
  tabLabelActive: {
    color: "#111111",
  },
});
