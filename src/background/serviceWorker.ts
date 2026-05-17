import { generateProfile } from "../shared/profileGenerator";
import { loadSettings } from "../shared/storage";
import { MESSAGE_TYPES } from "../shared/messages";
import type { FieldMapping, FieldSnapshot } from "../shared/types";

chrome.runtime.onInstalled.addListener(() => {
  console.info("Bill AutoFill installed");
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
        field.nearbyText
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
  if (message?.type !== MESSAGE_TYPES.RUN_AUTOFILL && message?.type !== MESSAGE_TYPES.CONFIRM_FILL) {
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
  mappings?: FieldMapping[];
}): Promise<unknown> {
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
  const profile = generateProfile({
    countryCode: settings.countryCode,
    gender: settings.gender,
    preferTaxExemptState: settings.preferTaxExemptState
  });
  const analysis = await chrome.tabs.sendMessage(tab.id!, {
    type: MESSAGE_TYPES.ANALYZE_PAGE
  });
  const fields = (analysis.fields ?? []) as FieldSnapshot[];
  const mappings = localMappings(fields);
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
