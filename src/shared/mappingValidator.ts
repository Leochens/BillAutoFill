import type {
  FieldKind,
  FieldMapping,
  FieldSnapshot,
  MappingValidationResult,
} from "./types";

const SUPPORTED_TARGETS = new Set<FieldKind>([
  "givenName",
  "familyName",
  "fullName",
  "streetLine1",
  "city",
  "region",
  "postalCode",
  "country",
  "phone",
  "email",
  "company",
  "gender",
]);

export function validateFieldMappings(
  fields: FieldSnapshot[],
  mappings: FieldMapping[],
  minimumConfidence = 0.55,
): MappingValidationResult {
  const knownFieldIds = new Set(fields.map((field) => field.fieldId));
  const validMappings: FieldMapping[] = [];
  const rejectedMappings: Array<FieldMapping & { reason: string }> = [];

  for (const mapping of mappings) {
    if (!knownFieldIds.has(mapping.fieldId)) {
      rejectedMappings.push({ ...mapping, reason: "Unknown field id" });
      continue;
    }

    if (!SUPPORTED_TARGETS.has(mapping.target)) {
      rejectedMappings.push({ ...mapping, reason: "Unsupported target" });
      continue;
    }

    if (mapping.confidence < minimumConfidence) {
      rejectedMappings.push({ ...mapping, reason: "Low confidence" });
      continue;
    }

    validMappings.push(mapping);
  }

  return { validMappings, rejectedMappings };
}
