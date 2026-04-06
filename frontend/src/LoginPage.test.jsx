import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import LoginPage from "./LoginPage";

function jsonResponse(payload, status = 200) {
  const text = JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => text,
  };
}

function renderLoginPage() {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) => {
      if (url === "/api/me/") {
        return jsonResponse({ detail: "Not authenticated" }, 401);
      }

      if (url === "/api/auth/csrf/") {
        return jsonResponse({ csrf: "ok" }, 200);
      }

      if (url === "/api/auth/login/") {
        return jsonResponse({ error: "Invalid credentials" }, 401);
      }

      return jsonResponse({}, 200);
    })
  );
});

describe("LoginPage", () => {
  test("renders username/email and password inputs", async () => {
    renderLoginPage();

    expect(screen.getByRole("heading", { name: /log in/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  test("submits and clears password on failed login", async () => {
    renderLoginPage();

    const identifierInput = screen.getByLabelText(/username or email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = await screen.findByRole("button", { name: /log in/i });

    fireEvent.change(identifierInput, { target: { value: "user@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "secret-password" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      expect(passwordInput).toHaveValue("");
    });
  });
});
