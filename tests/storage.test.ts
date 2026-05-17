import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, normalizeSettings } from "../src/shared/storage";

describe("normalizeSettings", () => {
  it("fills missing settings with defaults", () => {
    const settings = normalizeSettings({ countryCode: "JP" });

    expect(settings.countryCode).toBe("JP");
    expect(settings.gender).toBe(DEFAULT_SETTINGS.gender);
    expect(settings.trustedDomains).toEqual([]);
  });
});
