import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders a heading", () => {
  render(<App />);
  expect(screen.getByText(/vite/i)).toBeInTheDocument();
});
