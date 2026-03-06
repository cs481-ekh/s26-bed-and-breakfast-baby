import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, beforeEach, afterEach, describe, test, expect } from "vitest";
import App from "./App";

describe("App", () => {
 beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => [],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

  test("shows inline field errors returned by API", async () => {
    // Override the default fetch mock for this test
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        errors: {
          email: "A user with this email already exists.",
        },
      }),
    });

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("First Name"), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByPlaceholderText("Last Name"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("Employee ID"), {
      target: { value: "E12345" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "jane.doe@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirm Password"), {
      target: { value: "StrongPassword123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(
      await screen.findByText("A user with this email already exists.")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Please fix the highlighted fields.")
    ).toBeInTheDocument();
  });

  test("redirects to homepage after successful signup", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 1,
        email: "jane.doe@example.com",
        employee_id: "E12345",
        first_name: "Jane",
        last_name: "Doe",
        redirect_to: "/",
      }),
    });

    const assignSpy = vi.fn();
    vi.stubGlobal("location", {
      ...window.location,
      assign: assignSpy,
    });

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("First Name"), {
      target: { value: "Jane" },
    });
    fireEvent.change(screen.getByPlaceholderText("Last Name"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("Employee ID"), {
      target: { value: "E12345" },
    });
    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "jane.doe@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirm Password"), {
      target: { value: "StrongPassword123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith("/");
    });
  });

  test("renders the admin dashboard heading", async () => {
    // Ensure any initial fetches succeed so the render isn't disrupted.
    // (The beforeEach default already does this; this is just explicit.)
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: /admin dashboard/i })
    ).toBeInTheDocument();
  });
});