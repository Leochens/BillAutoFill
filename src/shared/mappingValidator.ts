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
  const mappedFieldIds = new Set<string>();
  const validMappings: FieldMapping[] = [];
  const rejectedMappings: MappingValidationResult["rejectedMappings"] = [];

  for (const mapping of mappings) {
    if (mapping === null || typeof mapping !== "object") {
      rejectedMappings.push({
        reason: `Malformed mapping: ${String(mapping)}`,
      });
      continue;
    }

    if (!knownFieldIds.has(mapping.fieldId)) {
      rejectedMappings.push({
        ...mapping,
        reason: `Unknown field id: ${String(mapping.fieldId)}`,
      });
      continue;
    }

    if (!SUPPORTED_TARGETS.has(mapping.target)) {
      rejectedMappings.push({
        ...mapping,
        reason: `Unsupported target: ${String(mapping.target)}`,
      });
      continue;
    }

    if (
      typeof mapping.confidence !== "number" ||
      !Number.isFinite(mapping.confidence)
    ) {
      rejectedMappings.push({
        ...mapping,
        reason: `Invalid confidence: ${String(mapping.confidence)}`,
      });
      continue;
    }

    if (mapping.confidence < minimumConfidence) {
      rejectedMappings.push({
        ...mapping,
        reason: `Low confidence: ${String(mapping.confidence)}`,
      });
      continue;
    }

    if (mappedFieldIds.has(mapping.fieldId)) {
      rejectedMappings.push({
        ...mapping,
        reason: `Duplicate field id: ${String(mapping.fieldId)}`,
      });
      continue;
    }

    mappedFieldIds.add(mapping.fieldId);
    validMappings.push(mapping);
  }

  return { validMappings, rejectedMappings };
}
