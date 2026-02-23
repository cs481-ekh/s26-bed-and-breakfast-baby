import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import App from "./App";

describe("Sign Up flow", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("shows inline field errors returned by API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({
        errors: {
          employee_id: "A user with this employee ID already exists.",
        },
      }),
    });

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("Name"), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("Employee ID"), {
      target: { value: "E12345" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirm Password"), {
      target: { value: "StrongPassword123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add User" }));

    expect(
      await screen.findByText("A user with this employee ID already exists.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Please fix the highlighted fields.")
    ).toBeInTheDocument();
  });

  test("redirects to homepage after successful signup", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 1,
        username: "E12345",
        name: "Jane Doe",
        is_staff: false,
        redirect_to: "/",
      }),
    });

    const assignSpy = vi.fn();
    vi.stubGlobal("location", {
      ...window.location,
      assign: assignSpy,
    });

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("Name"), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("Employee ID"), {
      target: { value: "E12345" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "StrongPassword123!" },
    });
    fireEvent.change(screen.getByPlaceholderText("Confirm Password"), {
      target: { value: "StrongPassword123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Add User" }));

    await waitFor(() => {
      expect(assignSpy).toHaveBeenCalledWith("/");
    });
  });
});
