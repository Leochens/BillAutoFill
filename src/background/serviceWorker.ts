import { generateProfile } from "../shared/profileGenerator";
import { buildProfileOptionsRequest, buildProviderRequest } from "../shared/providers";
import { loadSettings, saveSettings } from "../shared/storage";
import { MESSAGE_TYPES } from "../shared/messages";
import { validateFieldMappings } from "../shared/mappingValidator";
import type {
  AutofillTraceStep,
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

function hostPermissionPattern(url?: string): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return `${parsed.protocol}//${parsed.hostname}/*`;
  } catch {
    return undefined;
  }
}

async function pagePermissionResponse(tab: chrome.tabs.Tab): Promise<
  | { allowed: true }
  | { allowed: false; error: string; origin?: string }
> {
  const origin = hostPermissionPattern(tab.url);

  if (!origin) {
    return {
      allowed: false,
      error: "Bill AutoFill can only fill regular http and https pages."
    };
  }

  const allowed = await chrome.permissions.contains({ origins: [origin] });
  if (allowed) return { allowed: true };

  return {
    allowed: false,
    origin,
    error: `Bill AutoFill needs permission to access ${origin.replace("/*", "")} before it can fill this page.`
  };
}

function permissionRequiredResponse(error: string, origin?: string): Record<string, unknown> {
  return {
    error,
    code: MESSAGE_TYPES.NEED_HOST_PERMISSION,
    origin
  };
}

function isPageAccessError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Cannot access contents of the page") ||
    message.includes("Missing host permission") ||
    message.includes("The extensions gallery cannot be scripted");
}

function localMappings(fields: FieldSnapshot[]): FieldMapping[] {
  return fields
    .map((field): FieldMapping | undefined => {
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
            confidence: field.autocomplete ? 0.8 : 0.75,
            note: field.autocomplete
              ? `Matched autocomplete="${field.autocomplete}".`
              : "Matched visible field metadata."
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

function selectedProfileLabel(settings: ExtensionSettings, profileOptionId?: string): string {
  if (profileOptionId === "override") {
    return "Using a pasted profile from the side panel.";
  }

  if (profileOptionId === "random") {
    return `Generated a fresh fictional profile for ${settings.countryCode} with gender preference ${settings.gender}.`;
  }

  const selected = profileOptionId
    ? settings.savedProfiles.find((profile) => profile.id === profileOptionId)
    : settings.selectedProfileId
      ? settings.savedProfiles.find((profile) => profile.id === settings.selectedProfileId)
      : undefined;

  return selected
    ? `Using pre-generated ${selected.source === "ai" ? "AI" : "local"} profile: ${selected.label}.`
    : `Generated a fresh fictional profile for ${settings.countryCode} with gender preference ${settings.gender}.`;
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
  profileOverride?: BillingProfile;
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
  const pagePermission = await pagePermissionResponse(tab);
  if (!pagePermission.allowed) {
    return permissionRequiredResponse(pagePermission.error, pagePermission.origin);
  }

  try {
    await ensureContentScript(tab.id!);
  } catch (error) {
    if (isPageAccessError(error)) {
      return permissionRequiredResponse(
        "Chrome blocked access to this page. Grant site permission, then try again.",
        hostPermissionPattern(tab.url)
      );
    }

    throw error;
  }

  if (message.type === MESSAGE_TYPES.CONFIRM_FILL) {
    const fill = await chrome.tabs.sendMessage(tab.id!, {
      type: MESSAGE_TYPES.FILL_PAGE,
      profile: message.profile,
      mappings: message.mappings ?? []
    });

    return { mode: "filled", fillResult: fill.result };
  }

  const settings = await loadSettings();
  const profile = message.profileOverride ?? selectProfile(settings, message.profileOptionId);
  const analysis = await chrome.tabs.sendMessage(tab.id!, {
    type: MESSAGE_TYPES.ANALYZE_PAGE
  });
  const fields = (analysis.fields ?? []) as FieldSnapshot[];
  const trace: AutofillTraceStep[] = [
    {
      title: "Page scanned",
      detail: `Detected ${fields.length} eligible fields from inputs, textareas, and selectors.`
    },
    {
      title: "Profile prepared",
      detail: message.profileOverride
        ? selectedProfileLabel(settings, "override")
        : selectedProfileLabel(settings, message.profileOptionId)
    }
  ];
  const mapped = await mapFields(settings, fields);
  const mappings = mapped.mappings;
  trace.push(...mapped.trace);
  const host = exactHost(tab.url);
  const trusted = host ? settings.trustedDomains.includes(host) : false;

  if (settings.fillMode === "oneClickTrusted" && trusted) {
    const fill = await chrome.tabs.sendMessage(tab.id!, {
      type: MESSAGE_TYPES.FILL_PAGE,
      profile,
      mappings
    });

    return {
      mode: "filled",
      fillResult: fill.result,
      trace: [
        ...trace,
        {
          title: "Trusted fill completed",
          detail: `Filled ${fill.result?.filled ?? 0} fields on trusted host ${host}. The form was not submitted.`
        }
      ]
    };
  }

  return { profile, fields, mappings, mode: "preview", trace };
}

function selectProfile(settings: ExtensionSettings, profileOptionId?: string): BillingProfile {
  const selected = profileOptionId
    ? profileOptionId === "random"
      ? undefined
      : settings.savedProfiles.find((profile) => profile.id === profileOptionId)
    : settings.selectedProfileId
      ? settings.savedProfiles.find((profile) => profile.id === settings.selectedProfileId)
      : undefined;

  return selected?.profile ?? generateProfile({
    countryCode: settings.countryCode,
    gender: settings.gender,
    preferTaxExemptState: settings.preferTaxExemptState
  });
}

async function mapFields(
  settings: ExtensionSettings,
  fields: FieldSnapshot[]
): Promise<{ mappings: FieldMapping[]; trace: AutofillTraceStep[] }> {
  if (!settings.provider.apiKey.trim()) {
    const mappings = localMappings(fields);
    return {
      mappings,
      trace: [
        {
          title: "Local mapping used",
          detail: `No AI API key is configured, so local field rules mapped ${mappings.length} fields.`
        }
      ]
    };
  }

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
    if (validated.validMappings.length > 0) {
      return {
        mappings: validated.validMappings,
        trace: [
          {
            title: "AI mapping completed",
            detail: `${settings.provider.provider} ${settings.provider.model} proposed ${mappings.length} mappings; ${validated.validMappings.length} passed validation.`
          }
        ]
      };
    }

    const fallbackMappings = localMappings(fields);
    return {
      mappings: fallbackMappings,
      trace: [
        {
          title: "AI mapping fallback",
          detail: `AI returned no valid mappings, so local rules mapped ${fallbackMappings.length} fields.`
        }
      ]
    };
  } catch (error) {
    console.warn("Bill AutoFill AI mapping fallback:", error);
    const fallbackMappings = localMappings(fields);
    return {
      mappings: fallbackMappings,
      trace: [
        {
          title: "AI mapping fallback",
          detail: `Provider mapping failed, so local rules mapped ${fallbackMappings.length} fields.`
        }
      ]
    };
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
