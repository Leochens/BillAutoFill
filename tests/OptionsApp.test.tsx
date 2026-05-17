import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OptionsApp } from "../src/options/OptionsApp";
import { SETTINGS_KEY } from "../src/shared/storage";

describe("OptionsApp", () => {
  const get = vi.fn();
  const set = vi.fn();
  const remove = vi.fn();
  const sendMessage = vi.fn();

  beforeEach(() => {
    get.mockResolvedValue({});
    set.mockResolvedValue(undefined);
    remove.mockResolvedValue(undefined);
    sendMessage.mockResolvedValue({
      settings: {
        provider: { provider: "openai", apiKey: "", model: "gpt-4.1-mini" },
        countryCode: "US",
        gender: "any",
        preferTaxExemptState: false,
        trustedDomains: [],
        fillMode: "preview",
        savedProfiles: [
          {
            id: "profile-1",
            label: "Alex Bennett - Portland, OR",
            createdAt: "2026-05-17T00:00:00.000Z",
            source: "ai",
            profile: {
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
              email: "alex.bennett@example.test"
            }
          }
        ]
      },
      profiles: [{ id: "profile-1" }]
    });
    globalThis.chrome = {
      runtime: {
        sendMessage
      },
      storage: {
        local: {
          get,
          set,
          remove
        }
      }
    } as unknown as typeof chrome;
  });

  it("renders provider and country settings", async () => {
    render(<OptionsApp />);

    expect(await screen.findByLabelText(/provider/i)).toBeTruthy();
    expect(screen.getByLabelText(/preferred country/i)).toBeTruthy();
    expect(screen.getByLabelText(/trusted domains/i)).toBeTruthy();
  });

  it("saves current in-memory settings", async () => {
    render(<OptionsApp />);

    fireEvent.change(await screen.findByLabelText(/preferred country/i), {
      target: { value: "JP" }
    });
    fireEvent.change(screen.getByLabelText(/trusted domains/i), {
      target: { value: "shop.example.com\ncheckout.example.com" }
    });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(set).toHaveBeenCalledWith({
        [SETTINGS_KEY]: expect.objectContaining({
          countryCode: "JP",
          trustedDomains: ["shop.example.com", "checkout.example.com"]
        })
      });
    });
  });

  it("clears stored settings", async () => {
    render(<OptionsApp />);

    fireEvent.click(await screen.findByRole("button", { name: /clear stored settings/i }));

    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith(SETTINGS_KEY);
    });
  });

  it("generates address options through the extension runtime", async () => {
    render(<OptionsApp />);

    fireEvent.click(await screen.findByRole("button", { name: /generate with ai/i }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: "billAutofill/generateProfileOptions",
        count: 4
      }));
    });
    expect(await screen.findByText(/Alex Bennett - Portland, OR/i)).toBeTruthy();
  });

  it("adds a manual profile from pasted JSON", async () => {
    render(<OptionsApp />);

    fireEvent.click(await screen.findByRole("button", { name: /add manual profile/i }));

    expect(await screen.findByText(/manual profile added/i)).toBeTruthy();
    expect(screen.getByText(/Alex Bennett - Portland, OR/i)).toBeTruthy();
    await waitFor(() => {
      expect(set).toHaveBeenCalledWith({
        [SETTINGS_KEY]: expect.objectContaining({
          selectedProfileId: expect.stringMatching(/^manual-/),
          savedProfiles: expect.arrayContaining([
            expect.objectContaining({
              label: "Alex Bennett - Portland, OR",
              source: "local"
            })
          ])
        })
      });
    });
  });
});
