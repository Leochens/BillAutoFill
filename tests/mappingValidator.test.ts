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
    expect(result.rejectedMappings[0].reason).toBe(
      "Unknown field id: field-unknown",
    );
    expect(result.rejectedMappings[1].reason).toBe("Low confidence: 0.2");
  });

  it("rejects invalid confidence values for a known field and target", () => {
    const mappings = [
      { fieldId: "field-0", target: "givenName", confidence: Number.NaN },
      { fieldId: "field-0", target: "givenName" },
      { fieldId: "field-0", target: "givenName", confidence: "abc" },
      { fieldId: "field-0", target: "givenName", confidence: {} },
    ] as unknown as FieldMapping[];

    const result = validateFieldMappings(fields, mappings);

    expect(result.validMappings).toHaveLength(0);
    expect(result.rejectedMappings.map((mapping) => mapping.reason)).toEqual([
      "Invalid confidence: NaN",
      "Invalid confidence: undefined",
      "Invalid confidence: abc",
      "Invalid confidence: [object Object]",
    ]);
  });

  it("rejects duplicate field ids deterministically", () => {
    const mappings: FieldMapping[] = [
      { fieldId: "field-0", target: "givenName", confidence: 0.9 },
      { fieldId: "field-0", target: "familyName", confidence: 0.95 },
      { fieldId: "field-1", target: "postalCode", confidence: 0.9 },
    ];

    const result = validateFieldMappings(fields, mappings);

    expect(result.validMappings).toEqual([
      { fieldId: "field-0", target: "givenName", confidence: 0.9 },
      { fieldId: "field-1", target: "postalCode", confidence: 0.9 },
    ]);
    expect(result.rejectedMappings).toHaveLength(1);
    expect(result.rejectedMappings[0].reason).toBe(
      "Duplicate field id: field-0",
    );
  });

  it("rejects malformed entries without throwing", () => {
    const mappings = [
      null,
      "not-a-mapping",
      42,
      { fieldId: "field-0", target: "givenName", confidence: 0.9 },
    ] as unknown[] as FieldMapping[];

    expect(() => validateFieldMappings(fields, mappings)).not.toThrow();

    const result = validateFieldMappings(fields, mappings);

    expect(result.validMappings).toEqual([
      { fieldId: "field-0", target: "givenName", confidence: 0.9 },
    ]);
    expect(result.rejectedMappings.map((mapping) => mapping.reason)).toEqual([
      "Malformed mapping: null",
      "Malformed mapping: not-a-mapping",
      "Malformed mapping: 42",
    ]);
  });

  it("rejects unsupported target strings from untrusted data", () => {
    const mappings = [
      { fieldId: "field-0", target: "bogus", confidence: 0.9 },
    ] as unknown as FieldMapping[];

    const result = validateFieldMappings(fields, mappings);

    expect(result.validMappings).toHaveLength(0);
    expect(result.rejectedMappings).toHaveLength(1);
    expect(result.rejectedMappings[0].reason).toBe(
      "Unsupported target: bogus",
    );
  });
});
