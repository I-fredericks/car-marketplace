import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement window.scrollTo
window.scrollTo = window.scrollTo || (() => {});
