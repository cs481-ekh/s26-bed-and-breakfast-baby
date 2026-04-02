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
            {
              id: 24,
              label: "Bed 103",
              status: "held",
              notes: "[2026-03-30 09:30:00 UTC] Hold requested for testing.",
              updated_at: "2026-03-30T09:30:00Z",
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renders facility availability rows from API", async () => {
    render(<MainDash />);

    expect(await screen.findByText("Sunrise House")).toBeInTheDocument();
    expect(screen.getByLabelText("Search facilities or providers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filters" })).toBeInTheDocument();
    const facilityRow = screen.getByText("Sunrise House").closest("tr");
    expect(facilityRow).not.toBeNull();
    expect(screen.getByText("Provider A")).toBeInTheDocument();
    expect(within(facilityRow).getByText("1 - North")).toBeInTheDocument();
    expect(screen.getByText("tier 1")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/facilities/availability/");
  });

  test("searches facilities by facility or provider name", async () => {
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
            {
              facility_id: 2,
              facility_name: "Cedar Home",
              provider_name: "Beacon Housing",
              district_number: 2,
              district_name: "South",
              tier: "tier_2",
              total_beds: 6,
              assigned_beds: 2,
              available_beds: 4,
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

      return {
        ok: true,
        json: async () => [],
      };
    });

    render(<MainDash />);

    expect(await screen.findByText("Sunrise House")).toBeInTheDocument();
    expect(screen.getByText("Cedar Home")).toBeInTheDocument();

    const searchInput = screen.getByLabelText("Search facilities or providers");

    fireEvent.change(searchInput, { target: { value: "sun" } });
    expect(screen.getByText((_, element) => element?.textContent === "Sunrise House")).toBeInTheDocument();
    expect(screen.queryByText("Cedar Home")).not.toBeInTheDocument();
    expect(screen.getByText("Sun", { selector: ".search-match" })).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "beacon" } });
    expect(screen.queryByText("Sunrise House")).not.toBeInTheDocument();
    expect(screen.getByText("Cedar Home")).toBeInTheDocument();
    expect(screen.getByText("Beacon", { selector: ".search-match" })).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '"Sunrise House" AND "Provider A"' } });
    expect(screen.getByText("Sunrise House")).toBeInTheDocument();
    expect(screen.queryByText("Cedar Home")).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '"Sunrise House" OR "Beacon Housing"' } });
    expect(screen.getByText("Sunrise House")).toBeInTheDocument();
    expect(screen.getByText("Cedar Home")).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '"Sunrise House" AND "Beacon Housing"' } });
    expect(screen.getByText("No facilities found.")).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "nomatch" } });
    expect(screen.getByText("No facilities found.")).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "" } });
    expect(screen.getByText("Sunrise House")).toBeInTheDocument();
    expect(screen.getByText("Cedar Home")).toBeInTheDocument();
  });

  test("filters facilities by selected districts", async () => {
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
            {
              facility_id: 2,
              facility_name: "Cedar Home",
              provider_name: "Provider B",
              district_number: 2,
              district_name: "South",
              tier: "tier_2",
              total_beds: 6,
              assigned_beds: 2,
              available_beds: 4,
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

      return {
        ok: true,
        json: async () => [],
      };
    });

    render(<MainDash />);

    expect(await screen.findByText("Sunrise House")).toBeInTheDocument();
    expect(screen.getByText("Cedar Home")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.click(screen.getByLabelText("1 - North"));

    expect(screen.getByText("Sunrise House")).toBeInTheDocument();
    expect(screen.queryByText("Cedar Home")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear All Filters" }));

    expect(screen.getByText("Sunrise House")).toBeInTheDocument();
    expect(screen.getByText("Cedar Home")).toBeInTheDocument();
  });

  test("allows selecting gender target filters without changing displayed facilities", async () => {
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
            {
              facility_id: 2,
              facility_name: "Cedar Home",
              provider_name: "Provider B",
              district_number: 2,
              district_name: "South",
              tier: "tier_2",
              total_beds: 6,
              assigned_beds: 2,
              available_beds: 4,
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

      return {
        ok: true,
        json: async () => [],
      };
    });

    render(<MainDash />);

    expect(await screen.findByText("Sunrise House")).toBeInTheDocument();
    expect(screen.getByText("Cedar Home")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));

    expect(screen.getByText(/Gender Targets/i)).toBeInTheDocument();
    expect(screen.getByText("(in progress)")).toBeInTheDocument();

    const maleCenteredCheckbox = screen.getByLabelText("Male-only");
    const eitherCheckbox = screen.getByLabelText("Gender neutral");

    expect(maleCenteredCheckbox).not.toBeChecked();
    expect(eitherCheckbox).not.toBeChecked();

    fireEvent.click(maleCenteredCheckbox);
    fireEvent.click(eitherCheckbox);

    expect(maleCenteredCheckbox).toBeChecked();
    expect(eitherCheckbox).toBeChecked();

    // Gender-target filters are intentionally UI-only until backend support is added.
    expect(screen.getByText("Sunrise House")).toBeInTheDocument();
    expect(screen.getByText("Cedar Home")).toBeInTheDocument();
  });

  test("clear all filters resets search and filter selections", async () => {
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
            {
              facility_id: 2,
              facility_name: "Cedar Home",
              provider_name: "Beacon Housing",
              district_number: 2,
              district_name: "South",
              tier: "tier_2",
              total_beds: 6,
              assigned_beds: 2,
              available_beds: 4,
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

      return {
        ok: true,
        json: async () => [],
      };
    });

    render(<MainDash />);

    expect(await screen.findByText("Sunrise House")).toBeInTheDocument();
    expect(screen.getByText("Cedar Home")).toBeInTheDocument();

    const searchInput = screen.getByLabelText("Search facilities or providers");
    fireEvent.change(searchInput, { target: { value: "beacon" } });
    expect(screen.queryByText("Sunrise House")).not.toBeInTheDocument();
    expect(screen.getByText("Cedar Home")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    const districtCheckbox = screen.getByLabelText("1 - North");
    const genderCheckbox = screen.getByLabelText("Gender neutral");
    fireEvent.click(districtCheckbox);
    fireEvent.click(genderCheckbox);

    expect(districtCheckbox).toBeChecked();
    expect(genderCheckbox).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Clear All Filters" }));

    expect(searchInput).toHaveValue("");
    expect(districtCheckbox).not.toBeChecked();
    expect(genderCheckbox).not.toBeChecked();
    expect(screen.getByText("Sunrise House")).toBeInTheDocument();
    expect(screen.getByText("Cedar Home")).toBeInTheDocument();
  });

  test("shows facility bed rows when the facility is expanded", async () => {
    render(<MainDash />);

    expect(await screen.findByText("Sunrise House")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View Beds" }));

    expect(await screen.findByText("Bed 101")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    const notesText = screen.getByText("Near the nurse station");
    expect(notesText).toBeInTheDocument();
    const bed101Row = screen.getByText("Bed 101").closest("tr");
    expect(bed101Row).not.toBeNull();
    expect(within(bed101Row).getByTitle(/Last updated by Admin User on/i)).toBeInTheDocument();
    expect(within(bed101Row).getByText("Admin User")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/facilities/1/beds/");
  });

  test("filters parolee options by parolee number or name", async () => {
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
          json: async () => [
            {
              id: 9,
              idoc_id: "A1234",
              first_name: "Jane",
              last_name: "Doe",
            },
            {
              id: 10,
              idoc_id: "B5678",
              first_name: "John",
              last_name: "Smith",
            },
            {
              id: 11,
              idoc_id: "C9012",
              first_name: "Janet",
              last_name: "Brown",
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

    const paroleeSearch = await screen.findByLabelText("Search parolees for Bed 101");

    fireEvent.change(paroleeSearch, { target: { value: "A1234" } });
    expect(screen.getByRole("option", { name: "A1234 - Doe, Jane" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "B5678 - Smith, John" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "A1234 - Doe, Jane" }));
    expect(paroleeSearch).toHaveValue("A1234 - Doe, Jane");

    fireEvent.change(paroleeSearch, { target: { value: "Jane" } });
    expect(screen.getByRole("option", { name: "A1234 - Doe, Jane" })).toBeInTheDocument();

    fireEvent.change(paroleeSearch, { target: { value: "Brown" } });
    expect(screen.getByRole("option", { name: "C9012 - Brown, Janet" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "A1234 - Doe, Jane" })).not.toBeInTheDocument();
  });

  test("shows unassign action for occupied beds", async () => {
    render(<MainDash />);

    expect(await screen.findByText("Sunrise House")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Beds" }));

    expect(await screen.findByText("Bed 102")).toBeInTheDocument();
    expect(screen.getByText("Occupied")).toBeInTheDocument();
    const occupiedRow = screen.getByText("Bed 102").closest("tr");
    expect(occupiedRow).not.toBeNull();
    expect(within(occupiedRow).getByRole("button", { name: "Unassign" })).toBeInTheDocument();
  });

  test("shows hold request action for available beds", async () => {
    render(<MainDash />);

    expect(await screen.findByText("Sunrise House")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Beds" }));

    expect(await screen.findByText("Bed 101")).toBeInTheDocument();
    const availableRow = screen.getByText("Bed 101").closest("tr");
    expect(availableRow).not.toBeNull();
    expect(within(availableRow).getByRole("button", { name: "Request Hold" })).toBeInTheDocument();
  });

  test("shows release hold action for held beds", async () => {
    render(<MainDash />);

    expect(await screen.findByText("Sunrise House")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Beds" }));

    expect(await screen.findByText("Bed 103")).toBeInTheDocument();
    expect(screen.getByText("Held")).toBeInTheDocument();
    const heldRow = screen.getByText("Bed 103").closest("tr");
    expect(heldRow).not.toBeNull();
    expect(within(heldRow).getByRole("button", { name: "Release Hold" })).toBeInTheDocument();
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

  test("admins can expand and collapse full note history", async () => {
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
              notes: "[2026-03-30 07:00:00 UTC] oldest change\n[2026-03-30 08:00:00 UTC] second change\n[2026-03-30 09:00:00 UTC] third change\n[2026-03-30 10:00:00 UTC] newest change",
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

    expect(await screen.findByText("newest change")).toBeInTheDocument();
    expect(screen.queryByText("oldest change")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 3 of 4 changes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show full history" }));
    expect(await screen.findByText("oldest change")).toBeInTheDocument();
    expect(screen.getByText("Showing 4 of 4 changes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.queryByText("oldest change")).not.toBeInTheDocument();
  });

  test("shows only the last 3 note changes", async () => {
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
              notes: "[2026-03-30 07:00:00 UTC] oldest change\n[2026-03-30 08:00:00 UTC] second change\n[2026-03-30 09:00:00 UTC] third change\n[2026-03-30 10:00:00 UTC] newest change",
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

    expect(await screen.findByText("newest change")).toBeInTheDocument();
    expect(screen.getByText("third change")).toBeInTheDocument();
    expect(screen.getByText("second change")).toBeInTheDocument();
    expect(screen.queryByText("oldest change")).not.toBeInTheDocument();
  });
});
