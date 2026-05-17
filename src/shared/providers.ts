import { COUNTRY_DEFINITIONS } from "./countries";
import type { FieldSnapshot, ProfilePreferences, ProviderSettings } from "./types";

type ProviderBody =
  | {
      model: string;
      messages: Array<{ role: "system" | "user"; content: string }>;
      temperature: number;
    }
  | {
      contents: Array<{ parts: Array<{ text: string }> }>;
    };

export interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  body: ProviderBody;
}

type SafeFieldSnapshot = Pick<
  FieldSnapshot,
  | "fieldId"
  | "tagName"
  | "inputType"
  | "autocomplete"
  | "name"
  | "id"
  | "label"
  | "placeholder"
  | "ariaLabel"
  | "nearbyText"
  | "options"
>;

export function providerUrl(settings: ProviderSettings): string {
  switch (settings.provider) {
    case "openai":
      return "https://api.openai.com/v1/chat/completions";
    case "deepseek":
      return "https://api.deepseek.com/chat/completions";
    case "gemini":
      return `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent`;
    case "custom": {
      const baseUrl = settings.baseUrl?.trim().replace(/\/+$/, "");
      if (!baseUrl) {
        throw new Error("Custom provider base URL is required");
      }
      return `${baseUrl}/chat/completions`;
    }
  }
}

export function buildProviderRequest(
  settings: ProviderSettings,
  fields: FieldSnapshot[],
): ProviderRequest {
  const safeFields = fields.map(toSafeField);
  const prompt = [
    "Classify billing form fields for fictional test-data autofill.",
    "Return strict JSON only.",
    "Never submit forms.",
    "Use only these safe field metadata snapshots:",
    JSON.stringify(safeFields),
  ].join("\n");

  if (settings.provider === "gemini") {
    return {
      url: providerUrl(settings),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": settings.apiKey,
      },
      body: {
        contents: [{ parts: [{ text: prompt }] }],
      },
    };
  }

  return {
    url: providerUrl(settings),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: {
      model: settings.model,
      messages: [
        {
          role: "system",
          content:
            "You classify billing form fields for fictional test-data autofill. Return strict JSON only and never submit forms.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
    },
  };
}

export function buildProfileOptionsRequest(
  settings: ProviderSettings,
  preferences: ProfilePreferences,
  count: number
): ProviderRequest {
  const country = COUNTRY_DEFINITIONS[preferences.countryCode];
  const prompt = [
    `Generate ${count} fictional billing profiles for form testing.`,
    "Return strict JSON only.",
    "Use this shape: {\"profiles\":[{\"givenName\":\"...\",\"familyName\":\"...\",\"streetLine1\":\"...\",\"city\":\"...\",\"region\":\"...\",\"regionCode\":\"...\",\"postalCode\":\"...\",\"country\":\"...\",\"countryCode\":\"...\",\"phone\":\"...\",\"email\":\"...\",\"company\":\"...\",\"gender\":\"male|female|neutral\"}]}",
    "Do not use real people. Use example.test emails. Do not include payment, bank, government ID, password, or tax advice.",
    `Country: ${country.name} (${country.code}). Region label: ${country.regionLabel}. Postal label: ${country.postalLabel}. Phone prefix: ${country.phonePrefix}.`,
    `Gender preference: ${preferences.gender}.`,
    preferences.countryCode === "US" && preferences.preferTaxExemptState
      ? "For United States, choose only fictional addresses in AK, DE, MT, NH, or OR."
      : ""
  ]
    .filter(Boolean)
    .join("\n");

  if (settings.provider === "gemini") {
    return {
      url: providerUrl(settings),
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": settings.apiKey,
      },
      body: {
        contents: [{ parts: [{ text: prompt }] }],
      },
    };
  }

  return {
    url: providerUrl(settings),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: {
      model: settings.model,
      messages: [
        {
          role: "system",
          content:
            "You generate fictional billing profiles for test-form autofill. Return strict JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
    },
  };
}

function toSafeField(field: FieldSnapshot): SafeFieldSnapshot {
  return {
    fieldId: field.fieldId,
    tagName: field.tagName,
    inputType: field.inputType,
    autocomplete: field.autocomplete,
    name: field.name,
    id: field.id,
    label: field.label,
    placeholder: field.placeholder,
    ariaLabel: field.ariaLabel,
    nearbyText: field.nearbyText,
    options: field.options ? [...field.options] : undefined,
  };
}
