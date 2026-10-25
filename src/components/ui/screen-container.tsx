import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, MAX_CONTENT_WIDTH, spacing } from '@/theme';

export type ScreenContainerProps = {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * Safe-area edges to pad. Tab screens use the default (top/left/right; the tab bar
   * owns the bottom). Screens under a native header pass ['left', 'right', 'bottom'].
   */
  edges?: Edge[];
  /** Set false for content that must not scroll (it is still keyboard-aware). */
  scroll?: boolean;
  /** Extra bottom space so content clears a floating tab bar. */
  bottomInset?: number;
};

/**
 * Page wrapper: cream background, safe areas, a centred content column, and
 * keyboard avoidance so focused inputs stay visible.
 */
export function ScreenContainer({
  children,
  contentStyle,
  edges = ['top', 'left', 'right'],
  scroll = true,
  bottomInset = 0,
}: ScreenContainerProps) {
  const content = [styles.content, { paddingBottom: spacing.xxxl + bottomInset }, contentStyle];
  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, content]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.xl,
  },
});
