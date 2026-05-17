import { generateProfile } from "../shared/profileGenerator";
import { buildProfileOptionsRequest, buildProviderRequest } from "../shared/providers";
import { loadSettings, saveSettings } from "../shared/storage";
import { MESSAGE_TYPES } from "../shared/messages";
import { validateFieldMappings } from "../shared/mappingValidator";
import type {
  BillingProfile,
  ExtensionSettings,
  FieldMapping,
  FieldSnapshot,
  GeneratedProfileOption
} from "../shared/types";

chrome.runtime.onInstalled.addListener(() => {
  console.info("Bill AutoFill installed");
  void chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: true });
});

async function ensureContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["contentScript.js"]
  });
}

function localMappings(fields: FieldSnapshot[]): FieldMapping[] {
  return fields
    .map((field) => {
      const metadataText = [
        field.autocomplete,
        field.name,
        field.id,
        field.label,
        field.placeholder,
        field.ariaLabel,
        field.nearbyText,
        field.options?.join(" ")
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const target = inferTarget(metadataText);
      return target
        ? {
            fieldId: field.fieldId,
            target,
            confidence: field.autocomplete ? 0.8 : 0.75
          }
        : undefined;
    })
    .filter((mapping): mapping is FieldMapping => Boolean(mapping));
}

function inferTarget(text: string): FieldMapping["target"] | undefined {
  if (/\b(given|first|fname|first-name|first_name)\b/.test(text)) return "givenName";
  if (/\b(family|last|surname|lname|last-name|last_name)\b/.test(text)) return "familyName";
  if (/\b(address|street|address-line1|address_line1|addr1|line 1)\b/.test(text)) {
    return "streetLine1";
  }
  if (/\b(city|locality|town)\b/.test(text)) return "city";
  if (/\b(state|province|region|administrative-area)\b/.test(text)) return "region";
  if (/\b(zip|postal|postcode|postal-code|postal_code)\b/.test(text)) return "postalCode";
  if (/\b(country|country-name|country_name)\b/.test(text)) return "country";
  if (/\b(phone|tel|telephone|mobile)\b/.test(text)) return "phone";
  if (/\b(email|e-mail)\b/.test(text)) return "email";
  if (/\b(gender|sex|male|female|neutral)\b/.test(text)) return "gender";

  return undefined;
}

function exactHost(url?: string): string | undefined {
  if (!url) return undefined;

  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab available");
  return tab;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (
    message?.type !== MESSAGE_TYPES.RUN_AUTOFILL &&
    message?.type !== MESSAGE_TYPES.CONFIRM_FILL &&
    message?.type !== MESSAGE_TYPES.GET_SETTINGS &&
    message?.type !== MESSAGE_TYPES.GENERATE_PROFILE_OPTIONS
  ) {
    return false;
  }

  handleRuntimeMessage(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({ error: error instanceof Error ? error.message : String(error) });
    });

  return true;
});

async function handleRuntimeMessage(message: {
  type: string;
  profile?: unknown;
  profileOptionId?: string;
  mappings?: FieldMapping[];
  settings?: ExtensionSettings;
  count?: number;
}): Promise<unknown> {
  if (message.type === MESSAGE_TYPES.GET_SETTINGS) {
    return { settings: await loadSettings() };
  }

  if (message.type === MESSAGE_TYPES.GENERATE_PROFILE_OPTIONS) {
    return generateAndSaveProfileOptions(message.settings ?? (await loadSettings()), message.count ?? 4);
  }

  const tab = await getActiveTab();
  await ensureContentScript(tab.id!);

  if (message.type === MESSAGE_TYPES.CONFIRM_FILL) {
    const fill = await chrome.tabs.sendMessage(tab.id!, {
      type: MESSAGE_TYPES.FILL_PAGE,
      profile: message.profile,
      mappings: message.mappings ?? []
    });

    return { mode: "filled", fillResult: fill.result };
  }

  const settings = await loadSettings();
  const profile = selectProfile(settings, message.profileOptionId);
  const analysis = await chrome.tabs.sendMessage(tab.id!, {
    type: MESSAGE_TYPES.ANALYZE_PAGE
  });
  const fields = (analysis.fields ?? []) as FieldSnapshot[];
  const mappings = await mapFields(settings, fields);
  const host = exactHost(tab.url);
  const trusted = host ? settings.trustedDomains.includes(host) : false;

  if (settings.fillMode === "oneClickTrusted" && trusted) {
    const fill = await chrome.tabs.sendMessage(tab.id!, {
      type: MESSAGE_TYPES.FILL_PAGE,
      profile,
      mappings
    });

    return { mode: "filled", fillResult: fill.result };
  }

  return { profile, fields, mappings, mode: "preview" };
}

function selectProfile(settings: ExtensionSettings, profileOptionId?: string): BillingProfile {
  const selected = profileOptionId
    ? settings.savedProfiles.find((profile) => profile.id === profileOptionId)
    : settings.selectedProfileId
      ? settings.savedProfiles.find((profile) => profile.id === settings.selectedProfileId)
      : undefined;

  return selected?.profile ?? generateProfile({
    countryCode: settings.countryCode,
    gender: settings.gender,
    preferTaxExemptState: settings.preferTaxExemptState
  });
}

async function mapFields(settings: ExtensionSettings, fields: FieldSnapshot[]): Promise<FieldMapping[]> {
  if (!settings.provider.apiKey.trim()) return localMappings(fields);

  try {
    const request = buildProviderRequest(settings.provider, fields);
    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body)
    });
    if (!response.ok) throw new Error(`Provider mapping request failed: ${response.status}`);
    const payload = await response.json();
    const mappings = parseMappingsFromProviderPayload(payload);
    const validated = validateFieldMappings(fields, mappings);
    return validated.validMappings.length > 0 ? validated.validMappings : localMappings(fields);
  } catch (error) {
    console.warn("Bill AutoFill AI mapping fallback:", error);
    return localMappings(fields);
  }
}

function parseMappingsFromProviderPayload(payload: unknown): FieldMapping[] {
  const text = providerPayloadText(payload);
  const parsed = parseJsonPayload(text);
  const mappings = Array.isArray(parsed) ? parsed : parsed?.mappings;
  return Array.isArray(mappings) ? mappings as FieldMapping[] : [];
}

async function generateAndSaveProfileOptions(settings: ExtensionSettings, count: number): Promise<unknown> {
  const generated = await generateProfileOptions(settings, count);
  const nextSettings: ExtensionSettings = {
    ...settings,
    savedProfiles: generated,
    selectedProfileId: generated[0]?.id
  };
  await saveSettings(nextSettings);
  return { settings: nextSettings, profiles: generated };
}

async function generateProfileOptions(
  settings: ExtensionSettings,
  count: number
): Promise<GeneratedProfileOption[]> {
  if (settings.provider.apiKey.trim()) {
    try {
      const request = buildProfileOptionsRequest(settings.provider, {
        countryCode: settings.countryCode,
        gender: settings.gender,
        preferTaxExemptState: settings.preferTaxExemptState
      }, count);
      const response = await fetch(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.body)
      });
      if (!response.ok) throw new Error(`Provider profile request failed: ${response.status}`);
      const payload = await response.json();
      const parsed = parseJsonPayload(providerPayloadText(payload));
      const profiles = Array.isArray(parsed) ? parsed : parsed?.profiles;
      if (Array.isArray(profiles) && profiles.length > 0) {
        return profiles.slice(0, count).map((profile, index) =>
          profileOption(normalizeProfile(profile, settings, index), "ai", index)
        );
      }
    } catch (error) {
      console.warn("Bill AutoFill AI profile fallback:", error);
    }
  }

  return Array.from({ length: count }, (_, index) =>
    profileOption(generateProfile({
      countryCode: settings.countryCode,
      gender: settings.gender,
      preferTaxExemptState: settings.preferTaxExemptState,
      seed: Date.now() + index + 1
    }), "local", index)
  );
}

function normalizeProfile(value: unknown, settings: ExtensionSettings, index: number): BillingProfile {
  const fallback = generateProfile({
    countryCode: settings.countryCode,
    gender: settings.gender,
    preferTaxExemptState: settings.preferTaxExemptState,
    seed: Date.now() + index + 1
  });
  const profile = typeof value === "object" && value !== null ? value as Partial<BillingProfile> : {};

  return {
    ...fallback,
    ...profile,
    countryCode: settings.countryCode,
    country: profile.country || fallback.country,
    gender: profile.gender || fallback.gender,
    email: profile.email?.endsWith("@example.test") ? profile.email : fallback.email
  };
}

function profileOption(
  profile: BillingProfile,
  source: GeneratedProfileOption["source"],
  index: number
): GeneratedProfileOption {
  return {
    id: `${source}-${Date.now()}-${index}`,
    label: `${profile.givenName} ${profile.familyName} - ${profile.city}, ${profile.regionCode}`,
    profile,
    createdAt: new Date().toISOString(),
    source
  };
}

function providerPayloadText(payload: unknown): string {
  const value = payload as {
    choices?: Array<{ message?: { content?: string } }>;
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  return value.choices?.[0]?.message?.content ??
    value.candidates?.[0]?.content?.parts?.[0]?.text ??
    JSON.stringify(payload);
}

function parseJsonPayload(text: string): { mappings?: unknown; profiles?: unknown } | unknown[] {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned);
}
