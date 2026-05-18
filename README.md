# Bill AutoFill

[简体中文](./README.zh-CN.md) | English

Bill AutoFill is an open-source Chrome Manifest V3 extension for generating fictional billing profiles and filling test forms. It is intended for QA, demos, sandbox forms, and privacy-preserving test workflows.

It does not submit forms automatically and is not intended for real purchases, impersonation, tax avoidance, payment-card filling, password filling, or government-ID workflows.

## Features

- Side panel workflow that stays open while users interact with the page.
- Fictional profile generation with country, gender, and US tax-exempt-state preferences.
- Optional AI-assisted field mapping for inputs, textareas, and selectors.
- Reusable profiles generated in the Options page.
- Manual profile JSON paste in the side panel or Options page.
- Reviewable mapping preview with field-level confidence and short observable reasons.
- Current-site permission request before accessing a page.
- Local fallback mapping when no AI provider is configured.

## Privacy Model

Bill AutoFill is local-first and does not include a developer backend.

- Settings, API keys, trusted domains, and saved fictional profiles are stored in Chrome extension local storage.
- If an AI provider is configured, safe field metadata may be sent to that provider for field mapping.
- Existing user-entered form values are not intentionally sent to AI providers.
- Password fields, hidden fields, payment-card fields, submit buttons, file inputs, and existing values are ignored.
- Forms are never submitted automatically.

See [PRIVACY.md](./PRIVACY.md) for more detail.

## Install From Source

```bash
npm install
npm run build
```

Then:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the generated `dist/` directory.

## Development

```bash
npm install
npm test
npm run build
```

Useful files:

- `src/background/serviceWorker.ts`: extension orchestration, permissions, AI calls, and profile selection.
- `src/content/contentScript.ts`: field extraction and safe field filling.
- `src/popup/PopupApp.tsx`: side panel UI.
- `src/options/OptionsApp.tsx`: provider settings and reusable profile management.
- `src/shared/`: profile generation, countries, storage, providers, validation, and shared types.
- `docs/manual-test-form.html`: local form fixture for manual testing.

## Manual Test

Open an `http` or `https` test form in Chrome, click the extension icon, then run `Identify & Fill` from the side panel. The first fill on a site asks for that site's permission, then retries the autofill flow. New domains show a preview before filling unless the exact host is listed as trusted and one-click trusted fill is enabled.

For a simple fixture, open `docs/manual-test-form.html` in a local HTTP server or any static server. Avoid testing on real checkout flows unless you are certain it is a sandbox environment.

## AI Providers

The Options page supports OpenAI, DeepSeek, Gemini, and custom OpenAI-compatible endpoints. API keys are entered by the user and stored locally in Chrome extension storage.

When no API key is configured, Bill AutoFill still works with local heuristic mapping.

## Permissions

- `storage`: save settings, API provider configuration, and reusable fictional profiles.
- `sidePanel`: keep the extension UI open while users interact with forms.
- `scripting`: inject the content script only after user action and site permission.
- `tabs`: read the current tab URL to request and validate current-site permission.
- `activeTab`: support user-triggered access to the active tab.
- `optional_host_permissions`: request access to the current `http` or `https` site only when the user chooses to fill a page.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

See [SECURITY.md](./SECURITY.md).

## License

MIT. See [LICENSE](./LICENSE).
