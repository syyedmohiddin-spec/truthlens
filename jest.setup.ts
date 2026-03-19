// jest.setup.ts
import "@testing-library/jest-dom";

// Silence console.warn in tests unless explicitly testing for it
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = (...args: unknown[]) => {
    // Suppress expected warnings from provider fallbacks in tests
    const msg = String(args[0] || "");
    if (
      msg.includes("[Search]") ||
      msg.includes("[Cache]") ||
      msg.includes("[FactCheck]") ||
      msg.includes("[Context]")
    ) {
      return;
    }
    originalWarn(...args);
  };
});
afterAll(() => {
  console.warn = originalWarn;
});
