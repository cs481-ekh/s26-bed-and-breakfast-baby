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

      if (url === "/api/users/create-invite/") {
        return jsonResponse({
          message: "Invite created for new.user@example.com.",
          invite_link: "http://localhost:3000/register#test-token-123",
          expires_at: "2026-04-22T00:00:00Z",
          token: "test-token-123"
        }, 201);
      }

      if (url === "/api/admin/providers/") {
        return jsonResponse([
          { provider_id: 10, provider_name: "Provider A", is_active: true },
        ], 200);
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
    expect(screen.getByRole("button", { name: /create user account/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /providers/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^users$/i })).toBeInTheDocument();
  });

  test("create user account generates an invite link", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /create user account/i }));
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "new.user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate link/i }));

    expect(
      await screen.findByText(/invite created successfully/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/\/register#/i)).toBeInTheDocument();
    });
  });
});