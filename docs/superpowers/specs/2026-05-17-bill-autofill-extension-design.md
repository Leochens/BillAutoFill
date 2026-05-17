# Bill AutoFill Chrome Extension Design

Date: 2026-05-17

## Product Goal

Bill AutoFill is a Chrome extension for generating fictional billing profiles and quickly filling test, demo, sandbox, QA, and privacy-preserving forms. It is not designed for submitting false billing information to real merchants, impersonating real people, or bypassing tax rules.

The first store-ready version prioritizes clear user control, narrow browser permissions, privacy-respecting AI usage, and a polished popup/options experience.

## Target V1 Scope

The extension will support several common countries in V1:

- United States
- Canada
- United Kingdom
- Australia
- Germany
- France
- Japan
- Singapore

The user can choose a preferred country in settings. The generated test profile follows that country's address, phone, region, and postal-code conventions. United States-specific options, such as preferring tax-exempt states, live under the United States country profile rather than being treated as a global option.

## Core User Flow

1. The user opens a page with a billing or address form.
2. The user clicks the extension icon.
3. The popup shows the current profile preferences and a primary `Identify & Fill` action.
4. On new or untrusted domains, the extension detects visible form fields, generates a fictional billing profile, asks AI to map fields when needed, and shows a preview before filling.
5. The user confirms the mapping and the extension fills the page.
6. On trusted domains, the user may enable one-click fill so the same action can detect, generate, map, and fill immediately.

## Popup Design

The popup is a compact operational surface, not a marketing page.

Primary controls:

- `Identify & Fill` button
- Current country preference
- Gender preference
- United States tax-exempt-state preference when relevant
- Current mode: preview or trusted one-click fill
- Short status area for detection, generation, fill success, and errors
- Mapping preview for untrusted domains
- Confirmation controls after a preview is generated
- Shortcut link to Options

Popup states:

- Ready: shows preferences and primary action.
- Detecting: content script is collecting safe field context from the active tab.
- Generating: AI or local generator is producing fictional profile data.
- Preview: shows mapped fields and generated values before fill.
- Filled: confirms what was filled.
- Error: shows provider errors, unsupported pages, no fields found, permission issues, or malformed AI output.

## Options Page Design

The Options page is the configuration center.

AI provider settings:

- Provider: OpenAI, DeepSeek, Gemini, or Custom OpenAI-compatible endpoint.
- API key.
- Base URL when applicable.
- Model.
- Connection test using the current unsaved form state.
- Provider health result and last error.

Profile preferences:

- Preferred country.
- Gender: any, male, female, or neutral where supported.
- United States tax-exempt-state preference.
- Optional state, province, or region preference when applicable.
- Trusted domain management.
- Fill behavior defaults.

Privacy and safety settings:

- Explain that generated profiles are fictional test data.
- Explain that the extension sends only minimal field context to AI providers.
- Do not send existing user-entered form values to AI.
- Do not auto-submit forms.
- Let users clear stored settings.

## Architecture

The extension uses Chrome Manifest V3.

Main parts:

- `manifest.json`: declares MV3 extension metadata, action popup, options page, service worker, and narrow permissions.
- Popup app: handles the user-facing fill flow and transient status.
- Options app: stores AI provider and profile preferences.
- Service worker: coordinates storage, provider calls, and messages between popup and content scripts.
- Content script: detects fields, creates a safe DOM field snapshot, applies generated values, and returns fill results.
- Shared modules: profile schema, country definitions, field taxonomy, provider clients, mapping validation, and storage helpers.

Recommended permissions:

- `activeTab`: grants temporary access to the current tab after the user invokes the extension.
- `scripting`: injects or runs content script logic when needed.
- `storage`: persists provider and preference settings.

Recommended host permissions:

- Provider API hosts for built-in providers, such as OpenAI, DeepSeek, and Gemini.
- Custom provider host permissions requested only when the user configures a custom endpoint.

The design avoids broad persistent page host permissions in V1. Trusted-domain one-click behavior still begins from a user-invoked extension action and does not require automatic background access to every site.

## AI-Assisted Field Mapping

The chosen approach is AI-assisted field mapping.

Local deterministic logic does the first pass:

- Find visible input, select, textarea, and contenteditable controls.
- Read safe field metadata: `type`, `autocomplete`, `name`, `id`, labels, placeholder, ARIA label, nearby text, select options, and coarse DOM position.
- Ignore hidden fields, password fields, payment-card fields, existing user-entered values, and submit buttons.
- Normalize fields into a compact schema.

AI is used when deterministic rules are insufficient:

- Classify fields into a supported taxonomy such as first name, last name, street, city, region, postal code, country, phone, email, company, and gender.
- Return strict JSON with field ids, target profile keys, confidence, and notes.
- Never return executable code.
- Never decide to submit the form.

The service worker validates AI output before it reaches the content script. Invalid, low-confidence, or unsupported mappings are shown to the user for review instead of being silently filled.

## Fictional Profile Generation

Generated data should be realistic enough for form testing but clearly fictional.

Profile fields:

- Given name
- Family name
- Gender label when requested
- Street address
- City
- State, province, region, or prefecture
- Postal code
- Country
- Phone number
- Email address from a reserved or obviously test-oriented domain
- Optional company name

Generation strategy:

- Prefer local country templates and curated region datasets for stable fields.
- Use AI to add variety, localize formats, or fill gaps.
- Validate generated profiles against the selected country's schema.
- For United States tax-exempt-state preference, choose from supported tax-exempt states only when the selected country is United States.

## Country Model

Each country definition includes:

- Display name
- ISO country code
- Address field order
- Region label
- Postal-code label and validation pattern
- Phone format guidance
- Common form aliases
- Optional region datasets
- Country-specific preference fields

This keeps the United States rules from leaking into Canada, the United Kingdom, Australia, Germany, France, Japan, or Singapore.

## Storage Model

Persisted settings:

- Selected provider
- Provider credentials and base URL
- Preferred model
- Country preference
- Gender preference
- Country-specific preferences
- Trusted domains
- Fill mode defaults

Sensitive values such as API keys should be stored only in Chrome extension storage. The UI should mask keys by default and allow clearing them. The extension should not store generated profiles unless the user explicitly requests a reuse feature in a later version.

## Error Handling

Expected error states:

- No fillable fields found.
- Current page cannot be accessed.
- Provider API key missing.
- Provider request failed.
- AI response is malformed.
- Mapping confidence is too low.
- Page changed between preview and fill.
- Field became disabled or hidden before fill.

The popup should show concise messages and offer the next useful action, such as opening Options, retrying detection, or switching to preview mode.

## Chrome Web Store Readiness

The extension should be described as a fictional test-data autofill tool.

Store-readiness requirements:

- Single clear purpose: generate fictional billing profiles and fill test forms.
- No auto-submit behavior.
- No real identity impersonation claims.
- No tax avoidance claims.
- Minimal permissions.
- Clear privacy disclosure for AI provider calls.
- No remotely hosted executable logic.
- Provider responses are treated as data and validated locally.
- User can review mappings on untrusted domains.

Relevant Chrome documentation:

- Chrome `activeTab` permission guidance: https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- Chrome `scripting` API guidance: https://developer.chrome.com/docs/extensions/reference/api/scripting
- Chrome cross-origin request guidance: https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
- Chrome storage API guidance: https://developer.chrome.com/docs/extensions/reference/api/storage
- Chrome Web Store MV3 additional requirements: https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
- Chrome Web Store program policies: https://developer.chrome.com/docs/webstore/program-policies/policies

## Testing Strategy

Manual QA:

- Load the unpacked extension in Chrome.
- Test popup ready, preview, fill, and error states.
- Test options provider form and connection validation.
- Test each supported country on a local form fixture.
- Test trusted-domain one-click behavior.
- Confirm forms are not submitted automatically.

Automated or scripted checks:

- Unit tests for profile generation and country schema validation.
- Unit tests for DOM field extraction normalization.
- Unit tests for AI mapping validation.
- Fixture tests for common billing-form layouts.
- Build check for MV3 extension output.

## Out of Scope for V1

- Automatically submitting forms.
- Filling payment card, bank, government ID, password, or authentication fields.
- Persistent background access to all pages.
- Cloud-hosted agent orchestration.
- User account sync.
- Team management.
- Scraping or storing user-entered form data.
- Claims that generated addresses can be used for real purchases or tax benefits.

## Implementation Defaults

- Use React, TypeScript, and Vite for popup and options UI.
- Use local static country definitions and curated example datasets checked into the extension source for V1.
- Keep a deterministic local profile generator as the fallback path. Use AI for field mapping and profile variation when the user has configured a provider.
- Treat trusted domains as exact hosts in V1. Parent-domain inheritance can be added later only if the UI clearly explains the broader trust scope.
