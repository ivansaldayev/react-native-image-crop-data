import type { ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";
import { QuickStartExample } from "../snippets/QuickStartExample";

/**
 * Not one of plan S10's three scenarios -- a fourth tab hosting the minimal quick-start
 * usage (`../snippets/QuickStartExample.tsx`) mechanically lifted into the README's Quick
 * Start section, so that snippet is also real, running code rather than only text.
 */
export const QuickStartScreen = (): ReactElement => (
  <View style={styles.root}>
    <Text style={styles.caption}>Minimal usage -- lifted verbatim into the README's Quick Start section.</Text>
    <QuickStartExample />
  </View>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  caption: {
    padding: 12,
    color: "#6B7280",
  },
});
