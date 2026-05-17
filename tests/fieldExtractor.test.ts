import { extractFieldsFromDocument } from "../src/shared/fieldExtractor";
import { SIMPLE_US_FORM } from "../src/shared/fixtures/forms";

describe("extractFieldsFromDocument", () => {
  it("returns visible billing field metadata without user-entered values or passwords", () => {
    document.body.innerHTML = SIMPLE_US_FORM;

    const fields = extractFieldsFromDocument(document);

    expect(fields).toHaveLength(6);
    expect(fields.map((field) => field.id)).toEqual([
      "first-name",
      "last-name",
      "street",
      "city",
      "state",
      "zip"
    ]);
    expect(fields.every((field) => !("value" in field))).toBe(true);
    expect(fields.every((field) => field.inputType !== "password")).toBe(true);
    expect(fields.every((field) => field.autocomplete !== "cc-number")).toBe(true);
  });

  it("does not include textarea content nested inside a wrapping label", () => {
    document.body.innerHTML = `
      <form>
        <label>
          Notes
          <textarea id="notes" name="notes">private text</textarea>
        </label>
      </form>
    `;

    const fields = extractFieldsFromDocument(document);

    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      id: "notes",
      label: "Notes"
    });
    expect(fields[0].label).not.toContain("private text");
    expect(fields[0].nearbyText).not.toContain("private text");
  });

  it("does not include sibling control content in nearby text", () => {
    document.body.innerHTML = `
      <form>
        <div>
          <span>Billing details</span>
          <textarea id="private-notes">private text</textarea>
          <input id="first-name" name="firstName" />
        </div>
      </form>
    `;

    const fields = extractFieldsFromDocument(document);
    const firstName = fields.find((field) => field.id === "first-name");

    expect(firstName?.nearbyText).toBe("Billing details");
    expect(firstName?.nearbyText).not.toContain("private text");
  });

  it("excludes fields hidden by stylesheet classes", () => {
    document.body.innerHTML = `
      <style>
        .hidden { display: none; }
      </style>
      <form>
        <label for="visible">Visible</label>
        <input id="visible" name="visible" />
        <label for="hidden">Hidden</label>
        <input id="hidden" class="hidden" name="hidden" />
      </form>
    `;

    const fields = extractFieldsFromDocument(document);

    expect(fields.map((field) => field.id)).toEqual(["visible"]);
  });
});
