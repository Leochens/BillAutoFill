import { generateProfile } from "../src/shared/profileGenerator";

describe("generateProfile", () => {
  it("chooses a US tax-exempt state when preferred", () => {
    const profile = generateProfile({
      countryCode: "US",
      gender: "any",
      preferTaxExemptState: true,
      seed: 7
    });

    expect(profile.countryCode).toBe("US");
    expect(["AK", "DE", "MT", "NH", "OR"]).toContain(profile.regionCode);
    expect(profile.email).toMatch(/@example\.(test|com)$/);
    expect(profile.phone).toMatch(/^\+1/);
  });

  it.each(["US", "CA", "GB", "AU", "DE", "FR", "JP", "SG"] as const)(
    "generates required billing fields for %s",
    (countryCode) => {
      const profile = generateProfile({
        countryCode,
        gender: "neutral",
        seed: 11
      });

      expect(profile.givenName).not.toHaveLength(0);
      expect(profile.streetLine1).not.toHaveLength(0);
      expect(profile.postalCode).not.toHaveLength(0);
    }
  );
});
