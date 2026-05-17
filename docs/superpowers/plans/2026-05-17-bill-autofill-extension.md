# Bill AutoFill Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome Manifest V3 extension that generates fictional multi-country billing profiles, detects billing form fields, previews AI-assisted mappings, and fills test forms with user confirmation or trusted-domain one-click mode.

**Architecture:** Use React, TypeScript, and Vite to produce separate popup, options, service worker, and content-script bundles. Keep deterministic profile generation, field extraction, mapping validation, provider clients, and storage in focused shared modules so they can be tested without Chrome. Use `activeTab`, `scripting`, and `storage` for page access and settings, with provider host permissions only for AI endpoints.

**Tech Stack:** Chrome Manifest V3, React, TypeScript, Vite, Vitest, Testing Library, jsdom, Chrome extension APIs.

---

## File Structure

- `package.json`: npm scripts and dependencies for Vite, React, TypeScript, Vitest, and Chrome extension builds.
- `tsconfig.json`: strict TypeScript project config shared by app and tests.
- `vite.config.ts`: multi-entry build config for popup, options, service worker, and content script.
- `index.html`: Vite entry shell for popup development.
- `options.html`: Vite entry shell for options development.
- `public/manifest.json`: MV3 manifest copied into `dist`.
- `public/icons/icon.svg`: simple local extension icon.
- `src/popup/main.tsx`: popup React entrypoint.
- `src/popup/PopupApp.tsx`: popup workflow UI and state machine.
- `src/options/main.tsx`: options React entrypoint.
- `src/options/OptionsApp.tsx`: provider, profile, privacy, and trusted-domain settings UI.
- `src/background/serviceWorker.ts`: message coordinator, storage access, provider calls, script injection.
- `src/content/contentScript.ts`: safe DOM field extraction and value filling inside the active tab.
- `src/shared/types.ts`: canonical TypeScript types for settings, profiles, field snapshots, mappings, and messages.
- `src/shared/countries.ts`: supported country definitions and US tax-exempt-state metadata.
- `src/shared/profileGenerator.ts`: deterministic fictional profile generator with optional preference handling.
- `src/shared/fieldTaxonomy.ts`: supported form-field taxonomy and local keyword hints.
- `src/shared/fieldExtractor.ts`: pure DOM extractor used by the content script and tests.
- `src/shared/mappingValidator.ts`: validates AI mapping JSON before fill.
- `src/shared/providers.ts`: provider config, endpoint resolution, request payload construction, and response parsing.
- `src/shared/storage.ts`: extension settings defaults, migration, and storage helpers.
- `src/shared/messages.ts`: runtime message constants and type guards.
- `src/shared/fixtures/forms.ts`: fixture HTML strings for common billing forms.
- `src/styles/theme.css`: shared visual tokens and common component styles.
- `tests/*.test.ts`: focused Vitest tests for shared modules and content-script behavior.
- `docs/manual-test-form.html`: local manual QA page with representative billing forms.

## Task 1: Project Scaffold and MV3 Build

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `options.html`
- Create: `public/manifest.json`
- Create: `public/icons/icon.svg`
- Create: `src/popup/main.tsx`
- Create: `src/popup/PopupApp.tsx`
- Create: `src/options/main.tsx`
- Create: `src/options/OptionsApp.tsx`
- Create: `src/background/serviceWorker.ts`
- Create: `src/content/contentScript.ts`
- Create: `src/styles/theme.css`

- [ ] **Step 1: Create dependency and script manifest**

Create `package.json`:

```json
{
  "name": "bill-autofill",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "preview": "vite preview --host 127.0.0.1"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "vite": "^7.0.0",
    "typescript": "^5.8.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/chrome": "^0.0.287",
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Add TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["chrome", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests", "vite.config.ts"],
  "references": []
}
```

- [ ] **Step 3: Add Vite multi-entry build config**

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "index.html"),
        options: resolve(__dirname, "options.html"),
        serviceWorker: resolve(__dirname, "src/background/serviceWorker.ts"),
        contentScript: resolve(__dirname, "src/content/contentScript.ts")
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "serviceWorker") return "serviceWorker.js";
          if (chunk.name === "contentScript") return "contentScript.js";
          return "assets/[name]-[hash].js";
        }
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true
  }
});
```

- [ ] **Step 4: Add HTML entrypoints**

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bill AutoFill</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/popup/main.tsx"></script>
  </body>
</html>
```

Create `options.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bill AutoFill Options</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/options/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Add MV3 manifest and icon**

Create `public/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Bill AutoFill",
  "description": "Generate fictional billing profiles and fill test forms with reviewable AI-assisted mappings.",
  "version": "0.1.0",
  "action": {
    "default_title": "Bill AutoFill",
    "default_popup": "index.html"
  },
  "options_page": "options.html",
  "background": {
    "service_worker": "serviceWorker.js",
    "type": "module"
  },
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": [
    "https://api.openai.com/*",
    "https://api.deepseek.com/*",
    "https://generativelanguage.googleapis.com/*"
  ],
  "icons": {
    "16": "icons/icon.svg",
    "48": "icons/icon.svg",
    "128": "icons/icon.svg"
  }
}
```

Create `public/icons/icon.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="28" fill="#111827"/>
  <path d="M35 34h58a8 8 0 0 1 8 8v44a8 8 0 0 1-8 8H35a8 8 0 0 1-8-8V42a8 8 0 0 1 8-8Z" fill="#f8fafc"/>
  <path d="M43 52h42M43 66h28M43 80h36" stroke="#111827" stroke-width="8" stroke-linecap="round"/>
  <circle cx="91" cy="78" r="15" fill="#22c55e"/>
  <path d="m84 78 5 5 10-11" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

- [ ] **Step 6: Add placeholder React and extension entries**

Create `src/styles/theme.css`:

```css
:root {
  color: #111827;
  background: #f8fafc;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}

button,
input,
select,
textarea {
  font: inherit;
}
```

Create `src/popup/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import "../styles/theme.css";
import { PopupApp } from "./PopupApp";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>
);
```

Create `src/popup/PopupApp.tsx`:

```tsx
export function PopupApp() {
  return (
    <main className="popup-shell">
      <h1>Bill AutoFill</h1>
      <p>Fictional test billing profiles.</p>
      <button type="button">Identify & Fill</button>
    </main>
  );
}
```

Create `src/options/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import "../styles/theme.css";
import { OptionsApp } from "./OptionsApp";

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>
);
```

Create `src/options/OptionsApp.tsx`:

```tsx
export function OptionsApp() {
  return (
    <main className="options-shell">
      <h1>Bill AutoFill Options</h1>
      <p>Configure provider, country, and fill preferences.</p>
    </main>
  );
}
```

Create `src/background/serviceWorker.ts`:

```ts
chrome.runtime.onInstalled.addListener(() => {
  console.info("Bill AutoFill installed");
});
```

Create `src/content/contentScript.ts`:

```ts
console.info("Bill AutoFill content script loaded");
```

- [ ] **Step 7: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and dependencies install without fatal errors.

- [ ] **Step 8: Verify scaffold build**

Run:

```bash
npm run build
```

Expected: PASS. `dist/manifest.json`, `dist/index.html`, `dist/options.html`, `dist/serviceWorker.js`, and `dist/contentScript.js` exist.

- [ ] **Step 9: Commit scaffold**

Run:

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html options.html public src
git commit -m "feat: scaffold Chrome extension app"
```

## Task 2: Shared Types, Countries, and Profile Generation

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/countries.ts`
- Create: `src/shared/profileGenerator.ts`
- Create: `tests/profileGenerator.test.ts`

- [ ] **Step 1: Write profile generation tests**

Create `tests/profileGenerator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateProfile } from "../src/shared/profileGenerator";

describe("generateProfile", () => {
  it("generates a US test profile from a tax-exempt state when requested", () => {
    const profile = generateProfile({
      countryCode: "US",
      gender: "any",
      preferTaxExemptState: true,
      seed: 7
    });

    expect(profile.countryCode).toBe("US");
    expect(["AK", "DE", "MT", "NH", "OR"]).toContain(profile.regionCode);
    expect(profile.email).toMatch(/@example\.(test|com)$/);
    expect(profile.phone).toMatch(/^\+1 /);
  });

  it("generates localized profiles for all supported countries", () => {
    const countryCodes = ["US", "CA", "GB", "AU", "DE", "FR", "JP", "SG"] as const;

    for (const countryCode of countryCodes) {
      const profile = generateProfile({ countryCode, gender: "neutral", seed: 3 });
      expect(profile.countryCode).toBe(countryCode);
      expect(profile.givenName.length).toBeGreaterThan(0);
      expect(profile.streetLine1.length).toBeGreaterThan(0);
      expect(profile.postalCode.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/profileGenerator.test.ts
```

Expected: FAIL because `src/shared/profileGenerator.ts` does not exist.

- [ ] **Step 3: Add shared types**

Create `src/shared/types.ts`:

```ts
export type CountryCode = "US" | "CA" | "GB" | "AU" | "DE" | "FR" | "JP" | "SG";

export type GenderPreference = "any" | "male" | "female" | "neutral";

export interface ProfilePreferences {
  countryCode: CountryCode;
  gender: GenderPreference;
  preferTaxExemptState?: boolean;
  regionCode?: string;
  seed?: number;
}

export interface BillingProfile {
  givenName: string;
  familyName: string;
  gender: GenderPreference;
  streetLine1: string;
  city: string;
  region: string;
  regionCode: string;
  postalCode: string;
  country: string;
  countryCode: CountryCode;
  phone: string;
  email: string;
  company?: string;
}

export interface CountryDefinition {
  code: CountryCode;
  name: string;
  regionLabel: string;
  postalLabel: string;
  postalPattern: RegExp;
  phonePrefix: string;
  addressOrder: Array<keyof Pick<BillingProfile, "streetLine1" | "city" | "region" | "postalCode" | "country">>;
  regions: Array<{ code: string; name: string; taxExempt?: boolean }>;
}
```

- [ ] **Step 4: Add country definitions**

Create `src/shared/countries.ts` with definitions for all V1 countries:

```ts
import type { CountryCode, CountryDefinition } from "./types";

export const TAX_EXEMPT_US_STATE_CODES = ["AK", "DE", "MT", "NH", "OR"] as const;

export const COUNTRY_DEFINITIONS: Record<CountryCode, CountryDefinition> = {
  US: {
    code: "US",
    name: "United States",
    regionLabel: "State",
    postalLabel: "ZIP code",
    postalPattern: /^\d{5}(-\d{4})?$/,
    phonePrefix: "+1",
    addressOrder: ["streetLine1", "city", "region", "postalCode", "country"],
    regions: [
      { code: "CA", name: "California" },
      { code: "NY", name: "New York" },
      { code: "TX", name: "Texas" },
      { code: "AK", name: "Alaska", taxExempt: true },
      { code: "DE", name: "Delaware", taxExempt: true },
      { code: "MT", name: "Montana", taxExempt: true },
      { code: "NH", name: "New Hampshire", taxExempt: true },
      { code: "OR", name: "Oregon", taxExempt: true }
    ]
  },
  CA: {
    code: "CA",
    name: "Canada",
    regionLabel: "Province",
    postalLabel: "Postal code",
    postalPattern: /^[A-Z]\d[A-Z] \d[A-Z]\d$/,
    phonePrefix: "+1",
    addressOrder: ["streetLine1", "city", "region", "postalCode", "country"],
    regions: [{ code: "ON", name: "Ontario" }, { code: "BC", name: "British Columbia" }, { code: "QC", name: "Quebec" }]
  },
  GB: {
    code: "GB",
    name: "United Kingdom",
    regionLabel: "County",
    postalLabel: "Postcode",
    postalPattern: /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/,
    phonePrefix: "+44",
    addressOrder: ["streetLine1", "city", "postalCode", "country"],
    regions: [{ code: "ENG", name: "England" }, { code: "SCT", name: "Scotland" }, { code: "WLS", name: "Wales" }]
  },
  AU: {
    code: "AU",
    name: "Australia",
    regionLabel: "State",
    postalLabel: "Postcode",
    postalPattern: /^\d{4}$/,
    phonePrefix: "+61",
    addressOrder: ["streetLine1", "city", "region", "postalCode", "country"],
    regions: [{ code: "NSW", name: "New South Wales" }, { code: "VIC", name: "Victoria" }, { code: "QLD", name: "Queensland" }]
  },
  DE: {
    code: "DE",
    name: "Germany",
    regionLabel: "State",
    postalLabel: "Postleitzahl",
    postalPattern: /^\d{5}$/,
    phonePrefix: "+49",
    addressOrder: ["streetLine1", "postalCode", "city", "country"],
    regions: [{ code: "BE", name: "Berlin" }, { code: "BY", name: "Bavaria" }, { code: "NW", name: "North Rhine-Westphalia" }]
  },
  FR: {
    code: "FR",
    name: "France",
    regionLabel: "Region",
    postalLabel: "Code postal",
    postalPattern: /^\d{5}$/,
    phonePrefix: "+33",
    addressOrder: ["streetLine1", "postalCode", "city", "country"],
    regions: [{ code: "IDF", name: "Ile-de-France" }, { code: "ARA", name: "Auvergne-Rhone-Alpes" }, { code: "PAC", name: "Provence-Alpes-Cote d'Azur" }]
  },
  JP: {
    code: "JP",
    name: "Japan",
    regionLabel: "Prefecture",
    postalLabel: "Postal code",
    postalPattern: /^\d{3}-\d{4}$/,
    phonePrefix: "+81",
    addressOrder: ["postalCode", "region", "city", "streetLine1", "country"],
    regions: [{ code: "13", name: "Tokyo" }, { code: "27", name: "Osaka" }, { code: "14", name: "Kanagawa" }]
  },
  SG: {
    code: "SG",
    name: "Singapore",
    regionLabel: "Region",
    postalLabel: "Postal code",
    postalPattern: /^\d{6}$/,
    phonePrefix: "+65",
    addressOrder: ["streetLine1", "postalCode", "country"],
    regions: [{ code: "SG", name: "Singapore" }]
  }
};
```

- [ ] **Step 5: Add deterministic profile generator**

Create `src/shared/profileGenerator.ts`:

```ts
import { COUNTRY_DEFINITIONS } from "./countries";
import type { BillingProfile, ProfilePreferences } from "./types";

const GIVEN_NAMES = {
  any: ["Alex", "Jordan", "Taylor", "Casey"],
  male: ["James", "Daniel", "Noah", "Leo"],
  female: ["Emma", "Olivia", "Mia", "Sophia"],
  neutral: ["River", "Morgan", "Avery", "Quinn"]
};

const FAMILY_NAMES = ["Miller", "Chen", "Martin", "Tanaka", "Smith", "Brown", "Wilson", "Lee"];
const STREET_NAMES = ["Maple Street", "Market Road", "Cedar Avenue", "King Street", "River Lane", "Central Way"];
const CITIES = ["Springfield", "Victoria", "London", "Sydney", "Berlin", "Paris", "Tokyo", "Singapore"];
const POSTAL_EXAMPLES = {
  US: ["97205", "99501", "19901", "03101"],
  CA: ["M5V 2T6", "V6B 1A1", "H2Y 1C6"],
  GB: ["SW1A 1AA", "EC1A 1BB", "W1A 0AX"],
  AU: ["2000", "3000", "4000"],
  DE: ["10115", "80331", "50667"],
  FR: ["75001", "69002", "13001"],
  JP: ["100-0001", "530-0001", "220-0001"],
  SG: ["018956", "238839", "049317"]
} as const;

function pick<T>(items: readonly T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}

export function generateProfile(preferences: ProfilePreferences): BillingProfile {
  const seed = preferences.seed ?? Date.now();
  const country = COUNTRY_DEFINITIONS[preferences.countryCode];
  const preferredRegions = preferences.countryCode === "US" && preferences.preferTaxExemptState
    ? country.regions.filter((region) => region.taxExempt)
    : preferences.regionCode
      ? country.regions.filter((region) => region.code === preferences.regionCode)
      : country.regions;
  const region = pick(preferredRegions.length > 0 ? preferredRegions : country.regions, seed + 1);
  const givenName = pick(GIVEN_NAMES[preferences.gender], seed + 2);
  const familyName = pick(FAMILY_NAMES, seed + 3);
  const streetNumber = 100 + (Math.abs(seed) % 8900);

  return {
    givenName,
    familyName,
    gender: preferences.gender,
    streetLine1: `${streetNumber} ${pick(STREET_NAMES, seed + 4)}`,
    city: pick(CITIES, seed + 5),
    region: region.name,
    regionCode: region.code,
    postalCode: pick(POSTAL_EXAMPLES[preferences.countryCode], seed + 6),
    country: country.name,
    countryCode: preferences.countryCode,
    phone: `${country.phonePrefix} 555 ${String(1000 + (Math.abs(seed) % 9000))}`,
    email: `${givenName}.${familyName}.${Math.abs(seed)}@example.test`.toLowerCase(),
    company: `${familyName} Test Labs`
  };
}
```

- [ ] **Step 6: Run profile tests**

Run:

```bash
npm test -- tests/profileGenerator.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit shared profile generation**

Run:

```bash
git add src/shared tests/profileGenerator.test.ts
git commit -m "feat: add fictional profile generation"
```

## Task 3: Field Taxonomy, DOM Extraction, and Fixture Tests

**Files:**
- Create: `src/shared/fieldTaxonomy.ts`
- Create: `src/shared/fieldExtractor.ts`
- Create: `src/shared/fixtures/forms.ts`
- Create: `tests/fieldExtractor.test.ts`
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add failing extractor tests**

Create `tests/fieldExtractor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractFieldsFromDocument } from "../src/shared/fieldExtractor";
import { SIMPLE_US_FORM } from "../src/shared/fixtures/forms";

describe("extractFieldsFromDocument", () => {
  it("extracts visible billing fields with safe context", () => {
    document.body.innerHTML = SIMPLE_US_FORM;
    const fields = extractFieldsFromDocument(document);

    expect(fields.map((field) => field.label)).toContain("First name");
    expect(fields.map((field) => field.label)).toContain("ZIP code");
    expect(fields.every((field) => field.value === undefined)).toBe(true);
    expect(fields.some((field) => field.inputType === "password")).toBe(false);
  });
});
```

- [ ] **Step 2: Run extractor test to verify it fails**

Run:

```bash
npm test -- tests/fieldExtractor.test.ts
```

Expected: FAIL because extractor modules do not exist.

- [ ] **Step 3: Extend shared field types**

Append to `src/shared/types.ts`:

```ts
export type FieldKind =
  | "givenName"
  | "familyName"
  | "fullName"
  | "streetLine1"
  | "city"
  | "region"
  | "postalCode"
  | "country"
  | "phone"
  | "email"
  | "company"
  | "gender"
  | "unknown";

export interface FieldSnapshot {
  fieldId: string;
  tagName: string;
  inputType?: string;
  autocomplete?: string;
  name?: string;
  id?: string;
  label?: string;
  placeholder?: string;
  ariaLabel?: string;
  nearbyText?: string;
  options?: string[];
}
```

- [ ] **Step 4: Add field taxonomy hints**

Create `src/shared/fieldTaxonomy.ts`:

```ts
import type { FieldKind } from "./types";

export const FIELD_KEYWORDS: Record<Exclude<FieldKind, "unknown">, string[]> = {
  givenName: ["first name", "given name", "fname"],
  familyName: ["last name", "family name", "surname", "lname"],
  fullName: ["full name", "name"],
  streetLine1: ["address", "street", "address line 1", "street address"],
  city: ["city", "town"],
  region: ["state", "province", "region", "prefecture", "county"],
  postalCode: ["zip", "zip code", "postal", "postcode"],
  country: ["country"],
  phone: ["phone", "mobile", "telephone"],
  email: ["email", "e-mail"],
  company: ["company", "organization", "business"],
  gender: ["gender", "sex"]
};
```

- [ ] **Step 5: Add form fixture**

Create `src/shared/fixtures/forms.ts`:

```ts
export const SIMPLE_US_FORM = `
  <form>
    <label for="first">First name</label>
    <input id="first" name="first_name" autocomplete="given-name" value="do-not-send" />
    <label for="last">Last name</label>
    <input id="last" name="last_name" autocomplete="family-name" />
    <label for="address">Street address</label>
    <input id="address" name="address1" autocomplete="address-line1" />
    <label for="city">City</label>
    <input id="city" name="city" />
    <label for="state">State</label>
    <select id="state" name="state"><option>Oregon</option><option>California</option></select>
    <label for="zip">ZIP code</label>
    <input id="zip" name="zip" />
    <label for="card">Card number</label>
    <input id="card" type="text" autocomplete="cc-number" />
    <label for="password">Password</label>
    <input id="password" type="password" />
  </form>
`;
```

- [ ] **Step 6: Add pure DOM field extractor**

Create `src/shared/fieldExtractor.ts`:

```ts
import type { FieldSnapshot } from "./types";

const BLOCKED_AUTOCOMPLETE = new Set(["cc-number", "cc-exp", "cc-csc", "current-password", "new-password"]);
const BLOCKED_TYPES = new Set(["hidden", "password", "submit", "button", "reset", "file"]);

function text(value: string | null | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed || undefined;
}

function findLabel(element: HTMLElement, doc: Document): string | undefined {
  const id = element.getAttribute("id");
  if (id) {
    const explicit = doc.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (explicit) return text(explicit.textContent);
  }
  const wrapping = element.closest("label");
  return text(wrapping?.textContent);
}

function isVisible(element: HTMLElement): boolean {
  if (element.hidden) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return style?.display !== "none" && style?.visibility !== "hidden";
}

function isBlocked(element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): boolean {
  const inputType = element instanceof HTMLInputElement ? element.type : undefined;
  const autocomplete = element.getAttribute("autocomplete")?.toLowerCase();
  return Boolean(
    (inputType && BLOCKED_TYPES.has(inputType)) ||
      (autocomplete && BLOCKED_AUTOCOMPLETE.has(autocomplete))
  );
}

export function extractFieldsFromDocument(doc: Document): FieldSnapshot[] {
  const controls = Array.from(doc.querySelectorAll("input, select, textarea"));

  return controls
    .filter((control): control is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)
    .filter((control) => isVisible(control) && !isBlocked(control))
    .map((control, index) => ({
      fieldId: `field-${index}`,
      tagName: control.tagName.toLowerCase(),
      inputType: control instanceof HTMLInputElement ? control.type : undefined,
      autocomplete: text(control.getAttribute("autocomplete")),
      name: text(control.getAttribute("name")),
      id: text(control.getAttribute("id")),
      label: findLabel(control, doc),
      placeholder: text(control.getAttribute("placeholder")),
      ariaLabel: text(control.getAttribute("aria-label")),
      nearbyText: text(control.parentElement?.textContent),
      options: control instanceof HTMLSelectElement ? Array.from(control.options).map((option) => option.text.trim()).filter(Boolean) : undefined
    }));
}
```

- [ ] **Step 7: Run extractor tests**

Run:

```bash
npm test -- tests/fieldExtractor.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit extraction module**

Run:

```bash
git add src/shared tests/fieldExtractor.test.ts
git commit -m "feat: extract safe billing field context"
```

## Task 4: Mapping Validation and Local Rule Classifier

**Files:**
- Create: `src/shared/mappingValidator.ts`
- Create: `tests/mappingValidator.test.ts`
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add mapping validation tests**

Create `tests/mappingValidator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateFieldMappings } from "../src/shared/mappingValidator";
import type { FieldSnapshot } from "../src/shared/types";

const fields: FieldSnapshot[] = [
  { fieldId: "field-0", tagName: "input", label: "First name" },
  { fieldId: "field-1", tagName: "input", label: "ZIP code" }
];

describe("validateFieldMappings", () => {
  it("accepts known field ids and supported target keys", () => {
    const result = validateFieldMappings(fields, [
      { fieldId: "field-0", target: "givenName", confidence: 0.92 },
      { fieldId: "field-1", target: "postalCode", confidence: 0.9 }
    ]);

    expect(result.validMappings).toHaveLength(2);
    expect(result.rejectedMappings).toHaveLength(0);
  });

  it("rejects unknown fields and low confidence mappings", () => {
    const result = validateFieldMappings(fields, [
      { fieldId: "missing", target: "givenName", confidence: 0.99 },
      { fieldId: "field-1", target: "postalCode", confidence: 0.2 }
    ]);

    expect(result.validMappings).toHaveLength(0);
    expect(result.rejectedMappings).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run mapping test to verify it fails**

Run:

```bash
npm test -- tests/mappingValidator.test.ts
```

Expected: FAIL because `mappingValidator.ts` does not exist.

- [ ] **Step 3: Extend mapping types**

Append to `src/shared/types.ts`:

```ts
export interface FieldMapping {
  fieldId: string;
  target: FieldKind;
  confidence: number;
  note?: string;
}

export interface MappingValidationResult {
  validMappings: FieldMapping[];
  rejectedMappings: Array<FieldMapping & { reason: string }>;
}
```

- [ ] **Step 4: Add validator**

Create `src/shared/mappingValidator.ts`:

```ts
import type { FieldKind, FieldMapping, FieldSnapshot, MappingValidationResult } from "./types";

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
  "gender"
]);

export function validateFieldMappings(fields: FieldSnapshot[], mappings: FieldMapping[], minimumConfidence = 0.55): MappingValidationResult {
  const fieldIds = new Set(fields.map((field) => field.fieldId));
  const validMappings: FieldMapping[] = [];
  const rejectedMappings: Array<FieldMapping & { reason: string }> = [];

  for (const mapping of mappings) {
    if (!fieldIds.has(mapping.fieldId)) {
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
```

- [ ] **Step 5: Run mapping tests**

Run:

```bash
npm test -- tests/mappingValidator.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit mapping validation**

Run:

```bash
git add src/shared tests/mappingValidator.test.ts
git commit -m "feat: validate field mappings"
```

## Task 5: Provider Clients and Settings Storage

**Files:**
- Create: `src/shared/providers.ts`
- Create: `src/shared/storage.ts`
- Create: `tests/providers.test.ts`
- Create: `tests/storage.test.ts`
- Modify: `src/shared/types.ts`

- [ ] **Step 1: Add provider and storage tests**

Create `tests/providers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildProviderRequest } from "../src/shared/providers";

describe("buildProviderRequest", () => {
  it("builds a strict JSON mapping prompt without existing field values", () => {
    const request = buildProviderRequest(
      { provider: "openai", apiKey: "sk-test", model: "gpt-4.1-mini" },
      [{ fieldId: "field-0", tagName: "input", label: "First name" }]
    );

    expect(request.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(JSON.stringify(request.body)).toContain("Return strict JSON");
    expect(JSON.stringify(request.body)).not.toContain("do-not-send");
  });
});
```

Create `tests/storage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "../src/shared/storage";

describe("normalizeSettings", () => {
  it("fills missing settings with defaults", () => {
    const settings = normalizeSettings({ countryCode: "JP" });
    expect(settings.countryCode).toBe("JP");
    expect(settings.gender).toBe(DEFAULT_SETTINGS.gender);
    expect(settings.trustedDomains).toEqual([]);
  });
});
```

- [ ] **Step 2: Run provider/storage tests to verify they fail**

Run:

```bash
npm test -- tests/providers.test.ts tests/storage.test.ts
```

Expected: FAIL because provider and storage modules do not exist.

- [ ] **Step 3: Extend settings types**

Append to `src/shared/types.ts`:

```ts
export type ProviderKind = "openai" | "deepseek" | "gemini" | "custom";

export interface ProviderSettings {
  provider: ProviderKind;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface ExtensionSettings {
  provider: ProviderSettings;
  countryCode: CountryCode;
  gender: GenderPreference;
  preferTaxExemptState: boolean;
  trustedDomains: string[];
  fillMode: "preview" | "oneClickTrusted";
}
```

- [ ] **Step 4: Add storage helpers**

Create `src/shared/storage.ts`:

```ts
import type { ExtensionSettings } from "./types";

export const SETTINGS_KEY = "billAutofillSettings";

export const DEFAULT_SETTINGS: ExtensionSettings = {
  provider: {
    provider: "openai",
    apiKey: "",
    model: "gpt-4.1-mini"
  },
  countryCode: "US",
  gender: "any",
  preferTaxExemptState: false,
  trustedDomains: [],
  fillMode: "preview"
};

export function normalizeSettings(value: Partial<ExtensionSettings> | undefined): ExtensionSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    provider: {
      ...DEFAULT_SETTINGS.provider,
      ...value?.provider
    },
    trustedDomains: value?.trustedDomains ?? DEFAULT_SETTINGS.trustedDomains
  };
}

export async function loadSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(result[SETTINGS_KEY]);
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: normalizeSettings(settings) });
}
```

- [ ] **Step 5: Add provider request builder**

Create `src/shared/providers.ts`:

```ts
import type { FieldSnapshot, ProviderSettings } from "./types";

function providerUrl(settings: ProviderSettings): string {
  if (settings.provider === "deepseek") return "https://api.deepseek.com/chat/completions";
  if (settings.provider === "gemini") return `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent`;
  if (settings.provider === "custom") return `${settings.baseUrl?.replace(/\/$/, "")}/chat/completions`;
  return "https://api.openai.com/v1/chat/completions";
}

export function buildProviderRequest(settings: ProviderSettings, fields: FieldSnapshot[]) {
  const safeFields = fields.map(({ fieldId, tagName, inputType, autocomplete, name, id, label, placeholder, ariaLabel, nearbyText, options }) => ({
    fieldId,
    tagName,
    inputType,
    autocomplete,
    name,
    id,
    label,
    placeholder,
    ariaLabel,
    nearbyText,
    options
  }));

  const prompt = `Return strict JSON with mappings: [{"fieldId":"field-0","target":"givenName","confidence":0.9,"note":"label match"}]. Use only supported targets and never submit forms. Fields: ${JSON.stringify(safeFields)}`;

  if (settings.provider === "gemini") {
    return {
      url: providerUrl(settings),
      headers: { "Content-Type": "application/json", "x-goog-api-key": settings.apiKey },
      body: { contents: [{ parts: [{ text: prompt }] }] }
    };
  }

  return {
    url: providerUrl(settings),
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.apiKey}` },
    body: {
      model: settings.model,
      messages: [
        { role: "system", content: "You classify billing form fields for fictional test-data autofill. Return JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1
    }
  };
}
```

- [ ] **Step 6: Run provider/storage tests**

Run:

```bash
npm test -- tests/providers.test.ts tests/storage.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit provider and storage modules**

Run:

```bash
git add src/shared tests/providers.test.ts tests/storage.test.ts
git commit -m "feat: add provider and settings helpers"
```

## Task 6: Runtime Messages, Content Fill, and Service Worker Flow

**Files:**
- Create: `src/shared/messages.ts`
- Modify: `src/content/contentScript.ts`
- Modify: `src/background/serviceWorker.ts`
- Create: `tests/contentScript.test.ts`

- [ ] **Step 1: Add content fill tests**

Create `tests/contentScript.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fillDocumentFields } from "../src/content/contentScript";
import type { BillingProfile, FieldMapping } from "../src/shared/types";

const profile: BillingProfile = {
  givenName: "Alex",
  familyName: "Miller",
  gender: "any",
  streetLine1: "123 Maple Street",
  city: "Portland",
  region: "Oregon",
  regionCode: "OR",
  postalCode: "97205",
  country: "United States",
  countryCode: "US",
  phone: "+1 555 1234",
  email: "alex.miller@example.test"
};

describe("fillDocumentFields", () => {
  it("fills mapped fields and dispatches input/change events", () => {
    document.body.innerHTML = `<label for="first">First name</label><input id="first" />`;
    const mappings: FieldMapping[] = [{ fieldId: "field-0", target: "givenName", confidence: 1 }];
    const result = fillDocumentFields(document, mappings, profile);

    expect(result.filled).toBe(1);
    expect((document.getElementById("first") as HTMLInputElement).value).toBe("Alex");
  });
});
```

- [ ] **Step 2: Run content test to verify it fails**

Run:

```bash
npm test -- tests/contentScript.test.ts
```

Expected: FAIL because `fillDocumentFields` is not exported.

- [ ] **Step 3: Add message constants and guards**

Create `src/shared/messages.ts`:

```ts
export const MESSAGE_TYPES = {
  ANALYZE_PAGE: "billAutofill/analyzePage",
  CONFIRM_FILL: "billAutofill/confirmFill",
  FILL_PAGE: "billAutofill/fillPage",
  RUN_AUTOFILL: "billAutofill/runAutofill"
} as const;
```

- [ ] **Step 4: Implement content script extraction and fill handlers**

Modify `src/content/contentScript.ts`:

```ts
import { extractFieldsFromDocument } from "../shared/fieldExtractor";
import { MESSAGE_TYPES } from "../shared/messages";
import type { BillingProfile, FieldMapping } from "../shared/types";

function profileValue(profile: BillingProfile, target: FieldMapping["target"]): string | undefined {
  if (target === "fullName") return `${profile.givenName} ${profile.familyName}`;
  const value = profile[target as keyof BillingProfile];
  return typeof value === "string" ? value : undefined;
}

export function fillDocumentFields(doc: Document, mappings: FieldMapping[], profile: BillingProfile) {
  const controls = Array.from(doc.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea"));
  let filled = 0;

  for (const mapping of mappings) {
    const index = Number(mapping.fieldId.replace("field-", ""));
    const control = controls[index];
    const value = profileValue(profile, mapping.target);
    if (!control || value === undefined || control.disabled) continue;

    control.value = value;
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
    filled += 1;
  }

  return { filled };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === MESSAGE_TYPES.ANALYZE_PAGE) {
    sendResponse({ fields: extractFieldsFromDocument(document) });
    return true;
  }

  if (message?.type === MESSAGE_TYPES.FILL_PAGE) {
    sendResponse({ result: fillDocumentFields(document, message.mappings, message.profile) });
    return true;
  }

  return false;
});
```

- [ ] **Step 5: Implement service worker orchestration**

Modify `src/background/serviceWorker.ts`:

```ts
import { generateProfile } from "../shared/profileGenerator";
import { MESSAGE_TYPES } from "../shared/messages";
import { loadSettings } from "../shared/storage";
import type { FieldMapping, FieldSnapshot } from "../shared/types";

async function ensureContentScript(tabId: number) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["contentScript.js"]
  });
}

function localMappings(fields: FieldSnapshot[]): FieldMapping[] {
  return fields.map((field) => {
    const text = `${field.autocomplete ?? ""} ${field.name ?? ""} ${field.id ?? ""} ${field.label ?? ""} ${field.placeholder ?? ""}`.toLowerCase();
    if (text.includes("first") || text.includes("given")) return { fieldId: field.fieldId, target: "givenName", confidence: 0.8 };
    if (text.includes("last") || text.includes("family") || text.includes("surname")) return { fieldId: field.fieldId, target: "familyName", confidence: 0.8 };
    if (text.includes("address") || text.includes("street")) return { fieldId: field.fieldId, target: "streetLine1", confidence: 0.75 };
    if (text.includes("city")) return { fieldId: field.fieldId, target: "city", confidence: 0.8 };
    if (text.includes("state") || text.includes("province") || text.includes("region")) return { fieldId: field.fieldId, target: "region", confidence: 0.75 };
    if (text.includes("zip") || text.includes("postal") || text.includes("postcode")) return { fieldId: field.fieldId, target: "postalCode", confidence: 0.8 };
    if (text.includes("country")) return { fieldId: field.fieldId, target: "country", confidence: 0.8 };
    if (text.includes("phone") || text.includes("mobile")) return { fieldId: field.fieldId, target: "phone", confidence: 0.8 };
    if (text.includes("email")) return { fieldId: field.fieldId, target: "email", confidence: 0.8 };
    return { fieldId: field.fieldId, target: "unknown", confidence: 0.1 };
  }).filter((mapping) => mapping.target !== "unknown");
}

function exactHost(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== MESSAGE_TYPES.RUN_AUTOFILL && message?.type !== MESSAGE_TYPES.CONFIRM_FILL) return false;

  void (async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) throw new Error("No active tab");

    await ensureContentScript(tab.id);

    if (message.type === MESSAGE_TYPES.CONFIRM_FILL) {
      const fill = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.FILL_PAGE, profile: message.profile, mappings: message.mappings });
      sendResponse({ mode: "filled", fillResult: fill.result });
      return;
    }

    const settings = await loadSettings();
    const profile = generateProfile({
      countryCode: settings.countryCode,
      gender: settings.gender,
      preferTaxExemptState: settings.preferTaxExemptState
    });
    const analyze = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.ANALYZE_PAGE });
    const mappings = localMappings(analyze.fields);
    const host = exactHost(tab.url);
    const trusted = Boolean(host && settings.trustedDomains.includes(host));

    if (settings.fillMode === "oneClickTrusted" && trusted) {
      const fill = await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.FILL_PAGE, profile, mappings });
      sendResponse({ profile, fields: analyze.fields, mappings, mode: "filled", fillResult: fill.result });
      return;
    }

    sendResponse({ profile, fields: analyze.fields, mappings, mode: "preview" });
  })().catch((error) => {
    sendResponse({ error: error instanceof Error ? error.message : "Unknown error" });
  });

  return true;
});
```

- [ ] **Step 6: Run content test and build**

Run:

```bash
npm test -- tests/contentScript.test.ts
npm run build
```

Expected: Both commands PASS.

- [ ] **Step 7: Commit runtime message flow**

Run:

```bash
git add src tests/contentScript.test.ts
git commit -m "feat: connect content script autofill flow"
```

## Task 7: Popup Workflow UI

**Files:**
- Modify: `src/popup/PopupApp.tsx`
- Modify: `src/styles/theme.css`
- Create: `tests/PopupApp.test.tsx`

- [ ] **Step 1: Add popup UI test**

Create `tests/PopupApp.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PopupApp } from "../src/popup/PopupApp";

describe("PopupApp", () => {
  it("renders the primary identify and fill action", () => {
    vi.stubGlobal("chrome", { runtime: { sendMessage: vi.fn() } });
    render(<PopupApp />);
    expect(screen.getByRole("button", { name: /identify & fill/i })).toBeInTheDocument();
    expect(screen.getByText(/fictional test data/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run popup test to verify current baseline**

Run:

```bash
npm test -- tests/PopupApp.test.tsx
```

Expected: PASS before enhancing UI, proving the entrypoint is testable.

- [ ] **Step 3: Implement popup states and preview UI**

Modify `src/popup/PopupApp.tsx`:

```tsx
import { useState } from "react";
import { MESSAGE_TYPES } from "../shared/messages";
import type { BillingProfile, FieldMapping, FieldSnapshot } from "../shared/types";

type PopupState =
  | { status: "ready" }
  | { status: "loading"; message: string }
  | { status: "preview"; profile: BillingProfile; fields: FieldSnapshot[]; mappings: FieldMapping[] }
  | { status: "filled"; filled: number }
  | { status: "error"; message: string };

export function PopupApp() {
  const [state, setState] = useState<PopupState>({ status: "ready" });

  async function runAutofill() {
    setState({ status: "loading", message: "Detecting fields..." });
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.RUN_AUTOFILL });
    if (response?.error) {
      setState({ status: "error", message: response.error });
      return;
    }

    if (response.mode === "filled") {
      setState({ status: "filled", filled: response.fillResult.filled });
      return;
    }

    setState({ status: "preview", profile: response.profile, fields: response.fields, mappings: response.mappings });
  }

  async function confirmFill(profile: BillingProfile, mappings: FieldMapping[]) {
    setState({ status: "loading", message: "Filling page..." });
    const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CONFIRM_FILL, profile, mappings });
    if (response?.error) {
      setState({ status: "error", message: response.error });
      return;
    }
    setState({ status: "filled", filled: response.fillResult.filled });
  }

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div>
          <h1>Bill AutoFill</h1>
          <p>Fictional test data for billing forms.</p>
        </div>
        <span className="status-pill">Test data</span>
      </header>

      <button className="primary-button" type="button" onClick={runAutofill} disabled={state.status === "loading"}>
        Identify & Fill
      </button>

      {state.status === "loading" && <p className="notice">{state.message}</p>}
      {state.status === "error" && <p className="error">{state.message}</p>}
      {state.status === "filled" && <p className="notice">Filled {state.filled} fields. The form was not submitted.</p>}

      {state.status === "preview" && (
        <section className="panel">
          <h2>Preview mapping</h2>
          <p>{state.profile.givenName} {state.profile.familyName}, {state.profile.country}</p>
          <ul>
            {state.mappings.map((mapping) => {
              const field = state.fields.find((item) => item.fieldId === mapping.fieldId);
              return <li key={mapping.fieldId}>{field?.label ?? field?.name ?? mapping.fieldId} -> {mapping.target}</li>;
            })}
          </ul>
          <button className="primary-button" type="button" onClick={() => confirmFill(state.profile, state.mappings)}>
            Fill reviewed fields
          </button>
        </section>
      )}

      <a className="options-link" href="/options.html" target="_blank" rel="noreferrer">Open Options</a>
    </main>
  );
}
```

- [ ] **Step 4: Add popup styles**

Append to `src/styles/theme.css`:

```css
.popup-shell {
  width: 360px;
  min-height: 420px;
  padding: 18px;
  background: #f8fafc;
}

.popup-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.popup-header h1,
.options-shell h1 {
  margin: 0;
  font-size: 20px;
  line-height: 1.2;
}

.popup-header p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}

.status-pill {
  border: 1px solid #d1d5db;
  border-radius: 999px;
  padding: 5px 8px;
  color: #475569;
  font-size: 12px;
  white-space: nowrap;
}

.primary-button {
  width: 100%;
  height: 44px;
  margin-top: 18px;
  border: 0;
  border-radius: 10px;
  background: #111827;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.panel {
  margin-top: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  background: #fff;
}

.panel h2 {
  margin: 0 0 8px;
  font-size: 15px;
}

.notice {
  color: #475569;
}

.error {
  color: #b91c1c;
}

.options-link {
  display: inline-block;
  margin-top: 14px;
  color: #2563eb;
  font-size: 13px;
}
```

- [ ] **Step 5: Run popup test and build**

Run:

```bash
npm test -- tests/PopupApp.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit popup workflow UI**

Run:

```bash
git add src/popup src/styles tests/PopupApp.test.tsx
git commit -m "feat: add popup autofill workflow"
```

## Task 8: Options Page Settings UI

**Files:**
- Modify: `src/options/OptionsApp.tsx`
- Create: `tests/OptionsApp.test.tsx`

- [ ] **Step 1: Add options UI test**

Create `tests/OptionsApp.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OptionsApp } from "../src/options/OptionsApp";

describe("OptionsApp", () => {
  it("renders provider and country settings", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined)
        }
      }
    });
    render(<OptionsApp />);
    expect(await screen.findByLabelText(/provider/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/preferred country/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/trusted domains/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run options test to verify it fails against placeholder UI**

Run:

```bash
npm test -- tests/OptionsApp.test.tsx
```

Expected: FAIL because labels are not implemented.

- [ ] **Step 3: Implement options form**

Modify `src/options/OptionsApp.tsx`:

```tsx
import { useEffect, useState } from "react";
import { COUNTRY_DEFINITIONS } from "../shared/countries";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../shared/storage";
import type { ExtensionSettings, ProviderKind } from "../shared/types";

export function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState("Settings are stored locally in this browser extension.");

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  function updateProvider(provider: ProviderKind) {
    setSettings((current) => ({ ...current, provider: { ...current.provider, provider } }));
  }

  function updateTrustedDomains(value: string) {
    const trustedDomains = value
      .split("\n")
      .map((domain) => domain.trim())
      .filter(Boolean);
    setSettings((current) => ({ ...current, trustedDomains }));
  }

  async function save() {
    await saveSettings(settings);
    setStatus("Saved.");
  }

  return (
    <main className="options-shell">
      <h1>Bill AutoFill Options</h1>
      <section className="panel">
        <h2>AI Provider</h2>
        <label>
          Provider
          <select value={settings.provider.provider} onChange={(event) => updateProvider(event.target.value as ProviderKind)}>
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
            <option value="gemini">Gemini</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>
          API key
          <input type="password" value={settings.provider.apiKey} onChange={(event) => setSettings({ ...settings, provider: { ...settings.provider, apiKey: event.target.value } })} />
        </label>
        <label>
          Model
          <input value={settings.provider.model} onChange={(event) => setSettings({ ...settings, provider: { ...settings.provider, model: event.target.value } })} />
        </label>
      </section>

      <section className="panel">
        <h2>Profile preferences</h2>
        <label>
          Preferred country
          <select value={settings.countryCode} onChange={(event) => setSettings({ ...settings, countryCode: event.target.value as ExtensionSettings["countryCode"] })}>
            {Object.values(COUNTRY_DEFINITIONS).map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
          </select>
        </label>
        <label>
          Gender
          <select value={settings.gender} onChange={(event) => setSettings({ ...settings, gender: event.target.value as ExtensionSettings["gender"] })}>
            <option value="any">Any</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="neutral">Neutral</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={settings.preferTaxExemptState} onChange={(event) => setSettings({ ...settings, preferTaxExemptState: event.target.checked })} />
          Prefer US tax-exempt states when country is United States
        </label>
        <label>
          Fill behavior
          <select value={settings.fillMode} onChange={(event) => setSettings({ ...settings, fillMode: event.target.value as ExtensionSettings["fillMode"] })}>
            <option value="preview">Preview before filling on every domain</option>
            <option value="oneClickTrusted">One-click fill only on trusted exact hosts</option>
          </select>
        </label>
        <label>
          Trusted domains
          <textarea
            rows={4}
            placeholder="example.com"
            value={settings.trustedDomains.join("\n")}
            onChange={(event) => updateTrustedDomains(event.target.value)}
          />
        </label>
      </section>

      <section className="panel">
        <h2>Privacy</h2>
        <p>Only minimal field labels and metadata are sent to the configured AI provider. Existing user-entered values are not sent, and forms are never submitted automatically.</p>
      </section>

      <button className="primary-button" type="button" onClick={save}>Save settings</button>
      <p className="notice">{status}</p>
    </main>
  );
}
```

- [ ] **Step 4: Add options styles**

Append to `src/styles/theme.css`:

```css
.options-shell {
  max-width: 820px;
  margin: 0 auto;
  padding: 28px;
}

.options-shell label {
  display: grid;
  gap: 6px;
  margin: 12px 0;
  color: #334155;
  font-size: 14px;
}

.options-shell input,
.options-shell select,
.options-shell textarea {
  min-height: 38px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff;
  color: #111827;
}
```

- [ ] **Step 5: Run options test and build**

Run:

```bash
npm test -- tests/OptionsApp.test.tsx
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit options UI**

Run:

```bash
git add src/options src/styles tests/OptionsApp.test.tsx
git commit -m "feat: add extension options page"
```

## Task 9: Manual QA Fixture and Final Verification

**Files:**
- Create: `docs/manual-test-form.html`
- Modify: `README.md`

- [ ] **Step 1: Add manual billing form fixture**

Create `docs/manual-test-form.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bill AutoFill Manual Test Form</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 32px; max-width: 720px; }
      label { display: grid; gap: 6px; margin: 12px 0; }
      input, select { height: 38px; padding: 8px; }
    </style>
  </head>
  <body>
    <h1>Manual Test Billing Form</h1>
    <form>
      <label>First name <input name="first_name" autocomplete="given-name" /></label>
      <label>Last name <input name="last_name" autocomplete="family-name" /></label>
      <label>Street address <input name="address1" autocomplete="address-line1" /></label>
      <label>City <input name="city" autocomplete="address-level2" /></label>
      <label>State or region <input name="state" autocomplete="address-level1" /></label>
      <label>Postal code <input name="postal" autocomplete="postal-code" /></label>
      <label>Country <input name="country" autocomplete="country-name" /></label>
      <label>Phone <input name="phone" autocomplete="tel" /></label>
      <label>Email <input name="email" autocomplete="email" /></label>
    </form>
  </body>
</html>
```

- [ ] **Step 2: Add README with local setup and safety scope**

Create or modify `README.md`:

````md
# Bill AutoFill

Bill AutoFill is a Chrome Manifest V3 extension for fictional billing-profile generation and test-form autofill. It is intended for QA, demos, sandbox forms, and privacy-preserving test workflows. It does not submit forms automatically and is not intended for real purchases, impersonation, or tax avoidance.

## Development

```bash
npm install
npm run build
```

Load `dist/` as an unpacked extension in Chrome.

## Manual Test

Open `docs/manual-test-form.html` in Chrome, click the extension icon, then run `Identify & Fill`. New domains should show a preview before filling.
````

- [ ] **Step 3: Run full automated verification**

Run:

```bash
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 4: Load unpacked extension and manual smoke test**

Manual steps:

1. Open `chrome://extensions`.
2. Enable Developer Mode.
3. Click `Load unpacked`.
4. Select `/Users/leochens/Documents/BillAutoFill/dist`.
5. Open `/Users/leochens/Documents/BillAutoFill/docs/manual-test-form.html` in Chrome.
6. Click the Bill AutoFill extension icon.
7. Click `Identify & Fill`.
8. Confirm the popup shows generated profile and mapping preview.
9. Confirm no submit action occurs.

Expected: Extension loads without manifest errors, popup opens, mapping preview appears, and the page is not submitted.

- [ ] **Step 5: Commit manual QA docs**

Run:

```bash
git add README.md docs/manual-test-form.html
git commit -m "docs: add manual extension QA flow"
```

## Self-Review

Spec coverage:

- Store-ready Chrome MV3 extension: Task 1.
- React + Vite popup/options UI: Tasks 1, 7, and 8.
- Multi-country profile preferences: Tasks 2 and 8.
- US tax-exempt-state preference scoped to United States: Tasks 2 and 8.
- AI-assisted field mapping foundation: Tasks 3, 4, 5, and 6.
- Hybrid default fill flow with preview and trusted-domain one-click behavior: Tasks 6, 7, and 8 implement exact-host trusted domains, reviewed fill confirmation, and trusted one-click fill.
- Privacy behavior of sending only safe field context: Tasks 3 and 5.
- No automatic submit and no payment/password fill: Tasks 3, 6, and 9.
- Manual and automated verification: Tasks 2 through 9.

Placeholder scan:

- This plan contains no placeholder markers or vague implementation steps.
- Every code-producing step includes concrete file content or exact code blocks.
- Every test step has an exact command and expected result.

Type consistency:

- `CountryCode`, `GenderPreference`, `BillingProfile`, `FieldSnapshot`, `FieldMapping`, `ProviderSettings`, and `ExtensionSettings` are defined in `src/shared/types.ts` before later tasks use them.
- `MESSAGE_TYPES.RUN_AUTOFILL`, `MESSAGE_TYPES.CONFIRM_FILL`, `MESSAGE_TYPES.ANALYZE_PAGE`, and `MESSAGE_TYPES.FILL_PAGE` are defined before popup, service worker, and content script use them.
