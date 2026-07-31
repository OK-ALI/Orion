import "@testing-library/jest-dom/vitest";

beforeEach(() => {
  localStorage.clear();
  delete window.electron;
});
