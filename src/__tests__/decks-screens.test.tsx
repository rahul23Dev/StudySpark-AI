import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import DecksScreen from '@/app/(tabs)/decks';
import EditCardScreen from '@/app/deck/[id]/card/[cardId]';
import NewCardScreen from '@/app/deck/[id]/card/new';
import EditDeckScreen from '@/app/deck/[id]/edit';
import DeckDetailScreen from '@/app/deck/[id]/index';
import NewDeckScreen from '@/app/deck/new';

import { mockRouter, resetMockRouter, setMockParams } from '../../test/expo-router-mock';
import { openTestRepository } from '../../test/node-sqlite';
import { renderScreen } from '../../test/render';

jest.mock('expo-router', () => jest.requireActual('../../test/expo-router-mock'));

beforeEach(() => resetMockRouter());

const deckTitles = () =>
  screen.getAllByRole('button', { name: /cards? · Updated/ }).map((el) => String(el.props.accessibilityLabel).split('.')[0]);

describe('My Decks list', () => {
  it('shows the empty state with a create action', async () => {
    const { repo } = await openTestRepository();
    await renderScreen(<DecksScreen />, repo);
    expect(await screen.findByText('No decks yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Create your first deck' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/deck/new');
  });

  it('lists decks, searches and sorts', async () => {
    const { repo } = await openTestRepository();
    const bio = await repo.createDeck({ title: 'Biology', subject: 'Science' });
    await repo.createDeck({ title: 'algebra', subject: 'Math' });
    await repo.createDeck({ title: 'French' });
    await repo.createFlashcard(bio.id, { front: 'Cell', back: 'Unit of life' });

    await renderScreen(<DecksScreen />, repo);
    expect(await screen.findByText('3 decks')).toBeTruthy();
    // Recent first: Biology was touched last by adding a card.
    expect(deckTitles()).toEqual(['Biology, Science', 'French', 'algebra, Math']);
    expect(screen.getByText('1 card · Updated', { exact: false })).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'A–Z' }));
    await waitFor(() => expect(deckTitles()).toEqual(['algebra, Math', 'Biology, Science', 'French']));

    await fireEvent.changeText(screen.getByLabelText('Search decks'), 'sci');
    await waitFor(() => expect(deckTitles()).toEqual(['Biology, Science']));

    await fireEvent.changeText(screen.getByLabelText('Search decks'), 'zzz');
    expect(await screen.findByText('No matching decks')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    await waitFor(() => expect(deckTitles()).toHaveLength(3));

    await fireEvent.press(screen.getByRole('button', { name: /^Biology/ }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/deck/${bio.id}`);
  });

  it('offers a retry when loading fails', async () => {
    const { repo } = await openTestRepository();
    const listDecks = jest.spyOn(repo, 'listDecks').mockRejectedValueOnce(new Error('disk'));
    await renderScreen(<DecksScreen />, repo);
    expect(await screen.findByText("We couldn't load your decks.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No decks yet')).toBeTruthy();
    expect(listDecks).toHaveBeenCalledTimes(2);
  });
});

describe('creating and editing decks', () => {
  it('creates a deck and opens it with a success banner', async () => {
    const { repo } = await openTestRepository();
    await renderScreen(<NewDeckScreen />, repo);
    await fireEvent.changeText(screen.getByLabelText('Title'), '  World history ');
    await fireEvent.changeText(screen.getByLabelText('Subject (optional)'), 'History');
    await fireEvent.press(screen.getByRole('button', { name: 'Create deck' }));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalled());
    const [deck] = await repo.listDecks();
    expect(deck).toMatchObject({ title: 'World history', subject: 'History' });
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/deck/[id]', params: { id: deck.id, created: '1' } });
  });

  it('rejects a deck without a title', async () => {
    const { repo } = await openTestRepository();
    await renderScreen(<NewDeckScreen />, repo);
    await fireEvent.press(screen.getByRole('button', { name: 'Create deck' }));
    expect(await screen.findByText('Title is required.')).toBeTruthy();
    expect(await repo.listDecks()).toEqual([]);
  });

  it('renames a deck', async () => {
    const { repo } = await openTestRepository();
    const deck = await repo.createDeck({ title: 'Old name' });
    setMockParams({ id: deck.id });
    await renderScreen(<EditDeckScreen />, repo);
    await fireEvent.changeText(await screen.findByLabelText('Title'), 'New name');
    await fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect((await repo.getDeck(deck.id))?.title).toBe('New name');
  });
});

describe('deck detail', () => {
  async function openDeck(params: Record<string, string> = {}) {
    const { repo } = await openTestRepository();
    const deck = await repo.createDeck({ title: 'Chemistry', subject: 'Science', description: 'Atoms' });
    await repo.createFlashcard(deck.id, { front: 'H', back: 'Hydrogen' });
    await repo.createFlashcard(deck.id, { front: 'O', back: 'Oxygen', difficulty: 'hard' });
    setMockParams({ id: deck.id, ...params });
    await renderScreen(<DeckDetailScreen />, repo);
    await screen.findByText('CARDS (2)');
    return { repo, deck };
  }

  it('shows the deck, its cards and the created banner', async () => {
    await openDeck({ created: '1' });
    expect(screen.getByText('Deck created!')).toBeTruthy();
    expect(screen.getByText('Atoms')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Card 1: H\./ })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText('Deck created!')).toBeNull();
  });

  it('reorders cards', async () => {
    const { repo, deck } = await openDeck();
    expect(screen.getByRole('button', { name: 'Move card 1 up' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Move card 1 down' }));
    await waitFor(async () =>
      expect((await repo.listFlashcards(deck.id)).map((c) => c.front)).toEqual(['O', 'H']),
    );
    expect(await screen.findByRole('button', { name: /^Card 1: O\./ })).toBeTruthy();
  });

  it('duplicates the deck and opens the copy', async () => {
    const { repo } = await openDeck();
    await fireEvent.press(screen.getByRole('button', { name: 'Duplicate' }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());
    const copy = (await repo.listDecks()).find((d) => d.title === 'Chemistry (copy)');
    expect(copy?.cardCount).toBe(2);
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/deck/[id]', params: { id: copy!.id, duplicated: '1' } });
  });

  it('asks before deleting, and cancel keeps the deck', async () => {
    const { repo, deck } = await openDeck();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByTestId('confirm-dialog');
    expect(within(dialog).getByText('This deletes the deck and its 2 cards. This can\'t be undone.')).toBeTruthy();
    await fireEvent.press(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(await repo.getDeck(deck.id)).not.toBeNull();
  });

  it('deletes the deck and its cards after confirming', async () => {
    const { repo, deck } = await openDeck();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));
    await fireEvent.press(within(screen.getByTestId('confirm-dialog')).getByRole('button', { name: 'Delete deck' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/decks'));
    expect(await repo.getDeck(deck.id)).toBeNull();
    expect(await repo.listFlashcards(deck.id)).toEqual([]);
  });

  it('shows a not-found state for a missing deck', async () => {
    const { repo } = await openTestRepository();
    setMockParams({ id: 'missing' });
    await renderScreen(<DeckDetailScreen />, repo);
    expect(await screen.findByText('Deck not found')).toBeTruthy();
  });
});

describe('flashcard editor', () => {
  it('adds cards, including "save and add another"', async () => {
    const { repo } = await openTestRepository();
    const deck = await repo.createDeck({ title: 'Spanish' });
    setMockParams({ id: deck.id });
    await renderScreen(<NewCardScreen />, repo);

    await fireEvent.changeText(screen.getByLabelText('Front'), 'Hola');
    await fireEvent.changeText(screen.getByLabelText('Back'), 'Hello');
    await fireEvent.press(screen.getByRole('button', { name: 'Save and add another' }));
    expect(await screen.findByText('Card added. Add the next one.')).toBeTruthy();
    expect(screen.getByLabelText('Front').props.value).toBe('');

    await fireEvent.changeText(screen.getByLabelText('Front'), 'Adiós');
    await fireEvent.changeText(screen.getByLabelText('Back'), 'Goodbye');
    await fireEvent.press(screen.getByRole('radio', { name: 'Hard' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save card' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());

    expect((await repo.listFlashcards(deck.id)).map((c) => [c.front, c.back, c.difficulty, c.position])).toEqual([
      ['Hola', 'Hello', 'medium', 0],
      ['Adiós', 'Goodbye', 'hard', 1],
    ]);
  });

  it('requires both sides', async () => {
    const { repo } = await openTestRepository();
    const deck = await repo.createDeck({ title: 'Spanish' });
    setMockParams({ id: deck.id });
    await renderScreen(<NewCardScreen />, repo);
    await fireEvent.changeText(screen.getByLabelText('Front'), 'Only front');
    await fireEvent.press(screen.getByRole('button', { name: 'Save card' }));
    expect(await screen.findByText('Back is required.')).toBeTruthy();
    expect(await repo.listFlashcards(deck.id)).toEqual([]);
  });

  it('edits and deletes a card', async () => {
    const { repo } = await openTestRepository();
    const deck = await repo.createDeck({ title: 'Spanish' });
    const card = await repo.createFlashcard(deck.id, { front: 'Gato', back: 'Dog' });
    setMockParams({ id: deck.id, cardId: card.id });
    await renderScreen(<EditCardScreen />, repo);

    await fireEvent.changeText(await screen.findByLabelText('Back'), 'Cat');
    await fireEvent.press(screen.getByRole('button', { name: 'Save card' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
    expect((await repo.getFlashcard(card.id))?.back).toBe('Cat');

    await fireEvent.press(screen.getByRole('button', { name: 'Delete card' }));
    await fireEvent.press(within(screen.getByTestId('confirm-dialog')).getByRole('button', { name: 'Delete card' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(2));
    expect(await repo.getFlashcard(card.id)).toBeNull();
  });
});
