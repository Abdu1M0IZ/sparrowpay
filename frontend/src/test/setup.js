// Test environment setup for Vitest + React Testing Library.

import '@testing-library/jest-dom';

// matchMedia stub used by some Bootstrap/responsive helpers.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
