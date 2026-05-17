import { describe, expect, it } from "vitest";
import { fillDocumentFields } from "../src/content/contentScript";
import type { BillingProfile, FieldMapping } from "../src/shared/types";

describe("fillDocumentFields", () => {
  it("fills a mapped given name input", () => {
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

    document.body.innerHTML = `<label for="first">First name</label><input id="first" />`;

    const mappings: FieldMapping[] = [{ fieldId: "field-0", target: "givenName", confidence: 1 }];

    const result = fillDocumentFields(document, mappings, profile);

    expect(result.filled).toBe(1);
    expect(document.querySelector<HTMLInputElement>("#first")?.value).toBe("Alex");
  });
});
