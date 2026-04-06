import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, beforeEach, afterEach, describe, test, expect } from "vitest";
import App from "./App";

function jsonResponse(payload, status = 200) {
  const text = JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => text,
  };
}

describe("App", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/admin");

    vi.stubGlobal("fetch", vi.fn(async (url) => {
      if (url === "/api/me/") {
        return jsonResponse({ role: "admin" }, 200);
      }

      if (url === "/api/users/") {
        return jsonResponse([
          {
            id: 1,
            username: "admin",
            first_name: "System",
            last_name: "Admin",
            email: "admin@example.com",
            phone: "",
            role: "admin",
            is_active: true,
            date_joined: "2026-04-01T00:00:00Z",
          },
        ]);
      }

      return jsonResponse({}, 200);
    }));

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

    fireEvent.click(await screen.findByRole("button", { name: /create account/i }));
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