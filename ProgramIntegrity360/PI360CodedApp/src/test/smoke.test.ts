import { expect, test } from 'vitest';

test('provides jsdom and jest-dom matchers', () => {
  const element = document.createElement('div');
  document.body.append(element);

  expect(element).toBeInTheDocument();
});
