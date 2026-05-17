import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OptionsApp } from "../src/options/OptionsApp";
import { SETTINGS_KEY } from "../src/shared/storage";

describe("OptionsApp", () => {
  const get = vi.fn();
  const set = vi.fn();
  const remove = vi.fn();

  beforeEach(() => {
    get.mockResolvedValue({});
    set.mockResolvedValue(undefined);
    remove.mockResolvedValue(undefined);
    globalThis.chrome = {
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
});
