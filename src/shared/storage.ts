import type { ExtensionSettings } from "./types";

export const SETTINGS_KEY = "billAutofillSettings";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  provider: {
    provider: "openai",
    apiKey: "",
    model: "gpt-4.1-mini",
  },
  countryCode: "US",
  gender: "any",
  preferTaxExemptState: false,
  trustedDomains: [],
  fillMode: "preview",
  savedProfiles: [],
};

export function normalizeSettings(
  value?: Partial<ExtensionSettings>,
): ExtensionSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    provider: {
      ...DEFAULT_SETTINGS.provider,
      ...value?.provider,
    },
    trustedDomains: value?.trustedDomains
      ? [...value.trustedDomains]
      : [...DEFAULT_SETTINGS.trustedDomains],
    savedProfiles: value?.savedProfiles
      ? [...value.savedProfiles]
      : [...DEFAULT_SETTINGS.savedProfiles],
  };
}

export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);

  return normalizeSettings(
    stored[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined,
  );
}

export async function saveSettings(
  settings: Partial<ExtensionSettings>,
): Promise<void> {
  await chrome.storage.local.set({
    [SETTINGS_KEY]: normalizeSettings(settings),
  });
}
