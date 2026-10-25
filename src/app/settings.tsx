import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CheckIcon } from '@/components/icons';
import { AppText, Button, Card, Input, ListRow, ScreenContainer, SectionTitle } from '@/components/ui';
import { DEFAULT_DISPLAY_NAME } from '@/settings/display-name';
import { MAX_DISPLAY_NAME_LENGTH, useSettings } from '@/settings/settings-context';
import { colors, spacing } from '@/theme';

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

export default function SettingsScreen() {
  const { settings, setDisplayName } = useSettings();
  const [name, setName] = useState(settings.displayName);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const changed = name.trim() !== settings.displayName;

  async function save() {
    if (!changed) return;
    setSaveState('saving');
    try {
      await setDisplayName(name);
      setName(name.trim());
      setSaveState('saved');
    } catch {
      setSaveState('failed');
    }
  }

  return (
    <ScreenContainer edges={['left', 'right', 'bottom']}>
      <SectionTitle>Profile</SectionTitle>
      <Card style={styles.form}>
        <Input
          label="Display name"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setSaveState('idle');
          }}
          placeholder={DEFAULT_DISPLAY_NAME}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="done"
          onSubmitEditing={save}
          helperText={`Shown on your Home screen. Leave empty to use "${DEFAULT_DISPLAY_NAME}".`}
          errorText={saveState === 'failed' ? "Couldn't save. Please try again." : undefined}
        />
        <View style={styles.saveRow}>
          <Button label="Save" onPress={save} disabled={!changed} loading={saveState === 'saving'} />
          {saveState === 'saved' ? (
            <AppText variant="caption" color="success" accessibilityLiveRegion="polite">
              Saved
            </AppText>
          ) : null}
        </View>
      </Card>

      <SectionTitle>Appearance</SectionTitle>
      <Card style={styles.list}>
        <ListRow
          title="Light"
          subtitle="Warm cream theme"
          trailing={<CheckIcon color={colors.primaryText} />}
        />
      </Card>
      <AppText variant="caption" color="textMuted">
        A dark theme is planned for a later update.
      </AppText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  list: { padding: 0, overflow: 'hidden' },
});
