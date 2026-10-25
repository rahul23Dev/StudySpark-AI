import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button, EmptyState, ErrorState, Input, ListRow, LoadingState } from '@/components/ui';

describe('Button', () => {
  it('fires onPress and exposes a button role', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continue" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is inert while disabled or loading', async () => {
    const onPress = jest.fn();
    await render(
      <>
        <Button label="Disabled" onPress={onPress} disabled />
        <Button label="Busy" onPress={onPress} loading />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Disabled' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Busy' }));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Busy' }).props.accessibilityState).toMatchObject({ busy: true });
  });
});

describe('Input', () => {
  it('is labelled and reports changes', async () => {
    const onChangeText = jest.fn();
    await render(<Input label="Deck name" onChangeText={onChangeText} helperText="Up to 40 characters" />);
    await fireEvent.changeText(screen.getByLabelText('Deck name'), 'Biology');
    expect(onChangeText).toHaveBeenCalledWith('Biology');
    expect(screen.getByText('Up to 40 characters')).toBeTruthy();
  });

  it('shows the error instead of the helper text', async () => {
    await render(<Input label="Deck name" helperText="Helper" errorText="Name is required" />);
    expect(screen.getByText('Name is required')).toBeTruthy();
    expect(screen.queryByText('Helper')).toBeNull();
  });
});

describe('state views', () => {
  it('renders loading, empty and error states', async () => {
    const onRetry = jest.fn();
    await render(
      <>
        <LoadingState message="Loading decks" />
        <EmptyState title="Nothing here" message="Add something" />
        <ErrorState message="Network down" onRetry={onRetry} />
      </>,
    );
    expect(screen.getByLabelText('Loading decks')).toBeTruthy();
    expect(screen.getByText('Nothing here')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('ListRow', () => {
  it('is a button only when it has an action', async () => {
    await render(
      <>
        <ListRow title="Settings" onPress={() => {}} />
        <ListRow title="App version" subtitle="0.1.0" />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /App version/ })).toBeNull();
  });
});
