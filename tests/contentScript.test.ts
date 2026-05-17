import { describe, expect, it } from "vitest";
import { fillDocumentFields } from "../src/content/contentScript";
import { extractFieldsFromDocument } from "../src/shared/fieldExtractor";
import type { BillingProfile, FieldMapping } from "../src/shared/types";

describe("fillDocumentFields", () => {
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

  it("fills a mapped given name input", () => {
    document.body.innerHTML = `<label for="first">First name</label><input id="first" />`;

    const mappings: FieldMapping[] = [{ fieldId: "field-0", target: "givenName", confidence: 1 }];

    const result = fillDocumentFields(document, mappings, profile);

    expect(result.filled).toBe(1);
    expect(document.querySelector<HTMLInputElement>("#first")?.value).toBe("Alex");
  });

  it("fills the field id reported by extraction when disabled controls appear first", () => {
    document.body.innerHTML = `
      <label for="disabled-first">Disabled first</label>
      <input id="disabled-first" disabled />
      <label for="first">First name</label>
      <input id="first" />
    `;

    const extractedField = extractFieldsFromDocument(document).find((field) => field.id === "first");
    const mappings: FieldMapping[] = [
      { fieldId: extractedField?.fieldId ?? "missing", target: "givenName", confidence: 1 }
    ];

    const result = fillDocumentFields(document, mappings, profile);

    expect(result.filled).toBe(1);
    expect(document.querySelector<HTMLInputElement>("#disabled-first")?.value).toBe("");
    expect(document.querySelector<HTMLInputElement>("#first")?.value).toBe("Alex");
  });

  it("keeps mappings aligned when blocked and sensitive controls appear before an eligible field", () => {
    document.body.innerHTML = `
      <input id="hidden-token" type="hidden" />
      <input id="account-password" type="password" />
      <input id="card-number" autocomplete="cc-number" />
      <label for="first">First name</label>
      <input id="first" />
    `;

    const wrongMappings: FieldMapping[] = [
      { fieldId: "field-1", target: "familyName", confidence: 1 },
      { fieldId: "field-2", target: "email", confidence: 1 }
    ];
    const correctMappings: FieldMapping[] = [
      { fieldId: "field-0", target: "givenName", confidence: 1 }
    ];

    const wrongResult = fillDocumentFields(document, wrongMappings, profile);
    expect(wrongResult.filled).toBe(0);
    expect(document.querySelector<HTMLInputElement>("#first")?.value).toBe("");

    const correctResult = fillDocumentFields(document, correctMappings, profile);
    expect(correctResult.filled).toBe(1);
    expect(document.querySelector<HTMLInputElement>("#first")?.value).toBe("Alex");
  });

  it("selects matching options for country and region selectors", () => {
    document.body.innerHTML = `
      <label for="country">Country</label>
      <select id="country" name="country">
        <option value="">Choose</option>
        <option value="US">United States</option>
      </select>
      <label for="state">State</label>
      <select id="state" name="state">
        <option value="">Choose</option>
        <option value="OR">Oregon</option>
      </select>
    `;

    const result = fillDocumentFields(document, [
      { fieldId: "field-0", target: "country", confidence: 1 },
      { fieldId: "field-1", target: "region", confidence: 1 }
    ], profile);

    expect(result.filled).toBe(2);
    expect(document.querySelector<HTMLSelectElement>("#country")?.value).toBe("US");
    expect(document.querySelector<HTMLSelectElement>("#state")?.value).toBe("OR");
  });
});
