import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import MainDash from "./main_dash";

describe("MainDash", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        {
          facility_id: 1,
          facility_name: "Sunrise House",
          provider_name: "Provider A",
          district_number: 1,
          district_name: "North",
          tier: "tier_1",
          total_beds: 8,
          assigned_beds: 5,
          available_beds: 3,
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renders facility availability rows from API", async () => {
    render(<MainDash />);

    expect(await screen.findByText("Sunrise House")).toBeInTheDocument();
    expect(screen.getByText("Provider A")).toBeInTheDocument();
    expect(screen.getByText("1 - North")).toBeInTheDocument();
    expect(screen.getByText("tier 1")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/facilities/availability/");
  });
});
