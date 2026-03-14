import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import LoginPage from "./LoginPage";

describe("LoginPage", () => {
  test("renders email and password inputs", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: /log in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  test("submits and clears password", () => {
    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    fireEvent.change(emailInput, { target: { value: "user@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "secret-password" } });
    fireEvent.click(screen.getByRole("button", { name: /log in/i }));

    expect(screen.getByText("Login submitted for user@example.com.")).toBeInTheDocument();
    expect(passwordInput).toHaveValue("");
  });
});
