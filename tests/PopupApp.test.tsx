import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PopupApp } from "../src/popup/PopupApp";
import { MESSAGE_TYPES } from "../src/shared/messages";
import type { BillingProfile, FieldMapping, FieldSnapshot } from "../src/shared/types";

describe("PopupApp", () => {
  let sendMessage: ReturnType<typeof vi.fn>;

  const profile: BillingProfile = {
    givenName: "Alex",
    familyName: "Bennett",
    gender: "neutral",
    streetLine1: "123 Maple Street",
    city: "Portland",
    region: "Oregon",
    regionCode: "OR",
    postalCode: "97201",
    country: "United States",
    countryCode: "US",
    phone: "+1 555 123 4567",
    email: "alex.bennett@example.test",
    company: "Northstar Labs"
  };

  const fields: FieldSnapshot[] = [
    {
      fieldId: "field-0",
      tagName: "input",
      label: "First name",
      name: "first_name",
      id: "first-name"
    }
  ];

  const mappings: FieldMapping[] = [{ fieldId: "field-0", target: "givenName", confidence: 0.9 }];

  beforeEach(() => {
    sendMessage = vi.fn();
    globalThis.chrome = {
      runtime: {
        sendMessage
      }
    } as unknown as typeof chrome;
  });

  it("renders the popup workflow entrypoint", () => {
    render(<PopupApp />);

    expect(screen.getByRole("button", { name: /identify & fill/i })).toBeTruthy();
    expect(screen.getByText(/fictional test data/i)).toBeTruthy();
  });

  it("shows preview mappings after identifying fields", async () => {
    sendMessage.mockResolvedValue({ mode: "preview", profile, fields, mappings });
    render(<PopupApp />);

    fireEvent.click(screen.getByRole("button", { name: /identify & fill/i }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({ type: MESSAGE_TYPES.RUN_AUTOFILL });
    });
    expect(await screen.findByRole("heading", { name: /preview mapping/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /fill reviewed fields/i })).toBeTruthy();
    expect(screen.getByText(/first name/i)).toBeTruthy();
  });

  it("shows the fill safety notice when fields are filled", async () => {
    sendMessage.mockResolvedValue({ mode: "filled", fillResult: { filled: 2 } });
    render(<PopupApp />);

    fireEvent.click(screen.getByRole("button", { name: /identify & fill/i }));

    expect(await screen.findByText(/filled 2 fields\. the form was not submitted\./i)).toBeTruthy();
  });

  it("lets users choose a pre-generated profile before filling", async () => {
    sendMessage.mockImplementation((message) => {
      if (message.type === MESSAGE_TYPES.GET_SETTINGS) {
        return Promise.resolve({
          settings: {
            savedProfiles: [
              {
                id: "profile-1",
                label: "Alex Bennett - Portland, OR",
                profile,
                createdAt: "2026-05-17T00:00:00.000Z",
                source: "ai"
              }
            ],
            selectedProfileId: "profile-1"
          }
        });
      }

      return Promise.resolve({ mode: "preview", profile, fields, mappings });
    });

    render(<PopupApp />);

    expect(await screen.findByLabelText(/fill profile/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /identify & fill/i }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith({
        type: MESSAGE_TYPES.RUN_AUTOFILL,
        profileOptionId: "profile-1"
      });
    });
  });
});
