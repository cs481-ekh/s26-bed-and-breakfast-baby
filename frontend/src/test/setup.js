import "@testing-library/jest-dom";

// Default fetch mock for unit tests (prevents real network calls)
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => [],
});