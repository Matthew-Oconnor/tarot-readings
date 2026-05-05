import { act } from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import App from './App';
import { applyStreamUpdate } from './applyStreamUpdate';

function setVisibilityState(value) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  });
}

test('renders the welcome screen', () => {
  render(<App />);
  expect(screen.getByText(/hello traveler/i)).toBeInTheDocument();
});

test('flushes streamed text updates while the document is backgrounded', () => {
  const originalHasFocus = document.hasFocus;
  const setText = vi.fn();
  const flushSyncSpy = vi.fn((callback) => callback());

  setVisibilityState('hidden');
  document.hasFocus = vi.fn(() => false);

  act(() => {
    applyStreamUpdate(setText, 'streamed text', flushSyncSpy);
  });

  expect(flushSyncSpy).toHaveBeenCalledTimes(1);
  expect(setText).toHaveBeenCalledWith('streamed text');

  document.hasFocus = originalHasFocus;
  setVisibilityState('visible');
});
