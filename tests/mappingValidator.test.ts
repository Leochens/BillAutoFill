import { describe, expect, it } from "vitest";

import { validateFieldMappings } from "../src/shared/mappingValidator";
import type { FieldMapping, FieldSnapshot } from "../src/shared/types";

const fields: FieldSnapshot[] = [
  { fieldId: "field-0", tagName: "input", label: "First name" },
  { fieldId: "field-1", tagName: "input", label: "ZIP code" },
];

describe("validateFieldMappings", () => {
  it("accepts known field ids and supported targets", () => {
    const mappings: FieldMapping[] = [
      { fieldId: "field-0", target: "givenName", confidence: 0.9 },
      { fieldId: "field-1", target: "postalCode", confidence: 0.9 },
    ];

    const result = validateFieldMappings(fields, mappings);

    expect(result.validMappings).toHaveLength(2);
    expect(result.rejectedMappings).toHaveLength(0);
  });

  it("rejects unknown field ids and low confidence mappings", () => {
    const mappings: FieldMapping[] = [
      { fieldId: "field-unknown", target: "givenName", confidence: 0.9 },
      { fieldId: "field-1", target: "postalCode", confidence: 0.2 },
    ];

    const result = validateFieldMappings(fields, mappings);

    expect(result.validMappings).toHaveLength(0);
    expect(result.rejectedMappings).toHaveLength(2);
  });
});
