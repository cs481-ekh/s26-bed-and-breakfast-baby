import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, beforeEach, afterEach, describe, test, expect } from "vitest";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/admin");

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
  });

  afterEach(() => {
    window.history.pushState({}, "", "/");
    vi.restoreAllMocks();
  });

  test("renders admin sidebar and defaults to users panel", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: /admin dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /users/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^users$/i })).toBeInTheDocument();
  });

  test("create account stub generates a link preview", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "new.user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate link/i }));

    expect(
      await screen.findByText(/stub only: invite link generated locally/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/\/register\?token=/i)).toBeInTheDocument();
    });
  });
});