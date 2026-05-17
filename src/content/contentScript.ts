import { extractFieldsFromDocument } from "../shared/fieldExtractor";
import type { BillingProfile, FieldKind, FieldMapping, FieldSnapshot } from "../shared/types";

type FieldControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export interface FillResult {
  filled: number;
}

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

const MESSAGE_TYPES = {
  ANALYZE_PAGE: "billAutofill/analyzePage",
  FILL_PAGE: "billAutofill/fillPage"
} as const;

export function fillDocumentFields(
  doc: Document,
  mappings: FieldMapping[],
  profile: BillingProfile
): FillResult {
  const controlsByFieldId = getFillableControlsByFieldId(doc);
  let filled = 0;

  for (const mapping of mappings) {
    const control = controlsByFieldId.get(mapping.fieldId);
    const value = getProfileValue(profile, mapping.target);

    if (!control || isDisabled(control) || value === undefined) continue;

    setControlValue(control, value);
    filled += 1;
  }

  return { filled };
}

function getFillableControlsByFieldId(doc: Document): Map<string, FieldControl> {
  const fields = extractFieldsFromDocument(doc);
  const controls = Array.from(doc.querySelectorAll<FieldControl>(CONTROL_SELECTOR)).filter(
    isEligibleFillControl
  );
  const usedControls = new Set<FieldControl>();
  const controlsByFieldId = new Map<string, FieldControl>();

  fields.forEach((field) => {
    if (isSensitiveFieldSnapshot(field)) return;

    const matchedControl = findMatchingControl(field, controls, usedControls);

    if (matchedControl && !usedControls.has(matchedControl)) {
      usedControls.add(matchedControl);
      controlsByFieldId.set(field.fieldId, matchedControl);
    }
  });

  return controlsByFieldId;
}

function findMatchingControl(
  field: FieldSnapshot,
  controls: FieldControl[],
  usedControls: Set<FieldControl>
): FieldControl | undefined {
  return controls.find((control) => {
    if (usedControls.has(control)) return false;
    if (control.tagName.toLowerCase() !== field.tagName) return false;
    if (field.id && control.getAttribute("id") !== field.id) return false;
    if (field.name && control.getAttribute("name") !== field.name) return false;
    if (field.inputType && getInputType(control) !== field.inputType) return false;
    if (field.autocomplete && normalizeText(control.getAttribute("autocomplete")) !== field.autocomplete) {
      return false;
    }

    return true;
  });
}

function isEligibleFillControl(control: FieldControl): boolean {
  if (!isVisible(control)) return false;
  if (isDisabled(control)) return false;

  const inputType = getInputType(control);
  if (inputType && BLOCKED_INPUT_TYPES.has(inputType)) return false;

  const autocomplete = normalizeText(control.getAttribute("autocomplete"));
  if (autocomplete && hasSensitiveAutocomplete(autocomplete)) return false;

  return true;
}

function isVisible(element: HTMLElement): boolean {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    if (current.hidden || current.getAttribute("aria-hidden") === "true") return false;

    const style = current.ownerDocument.defaultView?.getComputedStyle(current) ?? current.style;
    if (style.display === "none" || style.visibility === "hidden") return false;
  }

  return true;
}

function isDisabled(control: FieldControl): boolean {
  return control.disabled || control.getAttribute("aria-disabled") === "true";
}

function getInputType(control: FieldControl): string | undefined {
  if (control instanceof HTMLInputElement) {
    return normalizeText(control.type) ?? "text";
  }

  return undefined;
}

function hasSensitiveAutocomplete(autocomplete: string): boolean {
  return autocomplete
    .toLowerCase()
    .split(/\s+/)
    .some((token) => SENSITIVE_AUTOCOMPLETE_VALUES.has(token));
}

function getProfileValue(profile: BillingProfile, target: FieldKind): string | undefined {
  if (target === "fullName") return `${profile.givenName} ${profile.familyName}`;
  if (target === "unknown") return undefined;

  const value = profile[target];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isSensitiveFieldSnapshot(field: FieldSnapshot): boolean {
  const text = [
    field.autocomplete,
    field.name,
    field.id,
    field.label,
    field.placeholder,
    field.ariaLabel,
    field.nearbyText
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\b(credit card|card number|cardholder|cc-|cc_|cvc|cvv|security code|expiry|expiration)\b/.test(
    text
  );
}

function setControlValue(control: FieldControl, value: string): void {
  if (control instanceof HTMLSelectElement) {
    const matchingOption = Array.from(control.options).find(
      (option) => option.value === value || option.textContent?.trim() === value
    );

    control.value = matchingOption?.value ?? value;
  } else {
    control.value = value;
  }

  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

function normalizeText(value: string | null | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : undefined;
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === MESSAGE_TYPES.ANALYZE_PAGE) {
      sendResponse({ fields: extractFieldsFromDocument(document) });
      return true;
    }

    if (message?.type === MESSAGE_TYPES.FILL_PAGE) {
      sendResponse({
        result: fillDocumentFields(document, message.mappings ?? [], message.profile)
      });
      return true;
    }

    return false;
  });
}
