import type { FieldSnapshot } from "./types";

const CONTROL_SELECTOR = "input, select, textarea";

const BLOCKED_INPUT_TYPES = new Set([
  "hidden",
  "password",
  "submit",
  "button",
  "reset",
  "file"
]);

const SENSITIVE_AUTOCOMPLETE_VALUES = new Set([
  "cc-number",
  "cc-exp",
  "cc-csc",
  "current-password",
  "new-password"
]);

type FieldControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export function extractFieldsFromDocument(doc: Document): FieldSnapshot[] {
  return Array.from(doc.querySelectorAll<FieldControl>(CONTROL_SELECTOR))
    .filter(isSafeVisibleField)
    .map((control, index) => toFieldSnapshot(control, index));
}

function isSafeVisibleField(control: FieldControl): boolean {
  if (!isVisible(control)) return false;

  const inputType = getInputType(control);
  if (inputType && BLOCKED_INPUT_TYPES.has(inputType)) return false;

  const autocomplete = normalizeOptional(control.getAttribute("autocomplete"));
  if (autocomplete && hasSensitiveAutocomplete(autocomplete)) return false;

  return true;
}

function toFieldSnapshot(control: FieldControl, index: number): FieldSnapshot {
  const snapshot: FieldSnapshot = {
    fieldId: `field-${index}`,
    tagName: control.tagName.toLowerCase()
  };

  assignIfPresent(snapshot, "inputType", getInputType(control));
  assignIfPresent(snapshot, "autocomplete", normalizeOptional(control.getAttribute("autocomplete")));
  assignIfPresent(snapshot, "name", normalizeOptional(control.getAttribute("name")));
  assignIfPresent(snapshot, "id", normalizeOptional(control.getAttribute("id")));
  assignIfPresent(snapshot, "label", getLabelText(control));
  assignIfPresent(snapshot, "placeholder", normalizeOptional(control.getAttribute("placeholder")));
  assignIfPresent(snapshot, "ariaLabel", normalizeOptional(control.getAttribute("aria-label")));
  assignIfPresent(snapshot, "nearbyText", getNearbyText(control));

  if (control instanceof HTMLSelectElement) {
    const options = Array.from(control.options)
      .map((option) => normalizeText(option.textContent))
      .filter((text): text is string => Boolean(text));

    if (options.length > 0) {
      snapshot.options = options;
    }
  }

  return snapshot;
}

function getInputType(control: FieldControl): string | undefined {
  if (control instanceof HTMLInputElement) {
    return normalizeOptional(control.type) ?? "text";
  }

  return undefined;
}

function isVisible(element: HTMLElement): boolean {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.hidden || current.getAttribute("aria-hidden") === "true") return false;

    const style = current.style;
    if (style.display === "none" || style.visibility === "hidden") return false;
  }

  return true;
}

function hasSensitiveAutocomplete(autocomplete: string): boolean {
  return autocomplete
    .toLowerCase()
    .split(/\s+/)
    .some((token) => SENSITIVE_AUTOCOMPLETE_VALUES.has(token));
}

function getLabelText(control: FieldControl): string | undefined {
  const wrappingLabel = control.closest("label");
  if (wrappingLabel) {
    return normalizeText(wrappingLabel.textContent);
  }

  const id = control.getAttribute("id");
  if (!id) return undefined;

  const explicitLabel = control.ownerDocument.querySelector<HTMLLabelElement>(
    `label[for="${escapeAttributeSelectorValue(id)}"]`
  );

  return normalizeText(explicitLabel?.textContent);
}

function getNearbyText(control: FieldControl): string | undefined {
  const parent = control.parentElement;
  if (!parent) return undefined;

  const text = Array.from(parent.childNodes)
    .filter((node) => node !== control)
    .map((node) => node.textContent ?? "")
    .join(" ");

  return normalizeText(text);
}

function assignIfPresent<K extends keyof FieldSnapshot>(
  snapshot: FieldSnapshot,
  key: K,
  value: FieldSnapshot[K] | undefined
): void {
  if (value !== undefined) {
    snapshot[key] = value;
  }
}

function normalizeOptional(value: string | null | undefined): string | undefined {
  return normalizeText(value);
}

function normalizeText(value: string | null | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : undefined;
}

function escapeAttributeSelectorValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
