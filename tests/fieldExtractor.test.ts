import { extractFieldsFromDocument } from "../src/shared/fieldExtractor";
import { SIMPLE_US_FORM } from "../src/shared/fixtures/forms";

describe("extractFieldsFromDocument", () => {
  it("returns visible billing field metadata without user-entered values or passwords", () => {
    document.body.innerHTML = SIMPLE_US_FORM;

    const fields = extractFieldsFromDocument(document);

    const labels = fields.map((field) => field.label);
    expect(labels).toContain("First name");
    expect(labels).toContain("ZIP code");
    expect(fields.every((field) => !("value" in field))).toBe(true);
    expect(fields.every((field) => field.inputType !== "password")).toBe(true);
  });
});
