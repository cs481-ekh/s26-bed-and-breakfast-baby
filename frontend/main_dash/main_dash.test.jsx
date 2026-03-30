import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import MainDash from "./main_dash";

describe("MainDash", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url === "/api/facilities/availability/") {
        return {
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
        };
      }

      if (url === "/api/parolees/") {
        return {
          ok: true,
          json: async () => [
            {
              id: 9,
              idoc_id: "A1234",
              first_name: "Jane",
              last_name: "Doe",
            },
          ],
        };
      }

      if (url === "/api/facilities/1/beds/") {
        return {
          ok: true,
          json: async () => [
            {
              id: 22,
              label: "Bed 101",
              status: "available",
              notes: "Near the nurse station",
              updated_at: "2026-03-30T10:15:00Z",
              updated_by: "Admin User",
              can_edit_notes: false,
            },
            {
              id: 23,
              label: "Bed 102",
              status: "occupied",
              notes: "",
              updated_at: "2026-03-29T08:00:00Z",
              updated_by: null,
              can_edit_notes: false,
            },
          ],
        };
      }

      return {
        ok: false,
        json: async () => ({ error: "Unknown endpoint" }),
      };
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

  test("shows facility bed rows when the facility is expanded", async () => {
    render(<MainDash />);

    expect(await screen.findByText("Sunrise House")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View Beds" }));

    expect(await screen.findByText("Bed 101")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("Near the nurse station")).toBeInTheDocument();
    expect(screen.getByText("Admin User")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/facilities/1/beds/");
  });

  test("shows unassign action for occupied beds", async () => {
    render(<MainDash />);

    expect(await screen.findByText("Sunrise House")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Beds" }));

    expect(await screen.findByText("Bed 102")).toBeInTheDocument();
    expect(screen.getByText("Occupied")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unassign" })).toBeInTheDocument();
  });

  test("shows notes column to all users", async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url === "/api/facilities/availability/") {
        return {
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
        };
      }

      if (url === "/api/parolees/") {
        return {
          ok: true,
          json: async () => [],
        };
      }

      if (url === "/api/facilities/1/beds/") {
        return {
          ok: true,
          json: async () => [
            {
              id: 22,
              label: "Bed 101",
              status: "available",
              notes: null,
              updated_at: "2026-03-30T10:15:00Z",
              updated_by: "Admin User",
              can_edit_notes: false,
            },
          ],
        };
      }

      return {
        ok: false,
        json: async () => ({ error: "Unknown endpoint" }),
      };
    });

    render(<MainDash />);
    expect(await screen.findByText("Sunrise House")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Beds" }));

    const bedsTable = await screen.findByRole("table", { name: "Sunrise House beds" });
    expect(within(bedsTable).getByText("Notes")).toBeInTheDocument();
    expect(within(bedsTable).getByText("None")).toBeInTheDocument();
    expect(within(bedsTable).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  test("shows note edit controls when user can edit notes", async () => {
    fetchMock.mockImplementation(async (url) => {
      if (url === "/api/facilities/availability/") {
        return {
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
        };
      }

      if (url === "/api/parolees/") {
        return {
          ok: true,
          json: async () => [],
        };
      }

      if (url === "/api/facilities/1/beds/") {
        return {
          ok: true,
          json: async () => [
            {
              id: 22,
              label: "Bed 101",
              status: "available",
              notes: "Admin note",
              updated_at: "2026-03-30T10:15:00Z",
              updated_by: "Admin User",
              can_edit_notes: true,
            },
          ],
        };
      }

      return {
        ok: false,
        json: async () => ({ error: "Unknown endpoint" }),
      };
    });

    render(<MainDash />);
    expect(await screen.findByText("Sunrise House")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Beds" }));

    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
  });
});
