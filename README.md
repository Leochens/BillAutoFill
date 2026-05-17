# Bill AutoFill

Bill AutoFill is a Chrome Manifest V3 extension for fictional billing-profile generation and test-form autofill. It is intended for QA, demos, sandbox forms, and privacy-preserving test workflows.

It does not submit forms automatically and is not intended for real purchases, impersonation, or tax avoidance.

## Development

```bash
npm install
npm run build
```

Load `dist/` as an unpacked extension in Chrome.

## Manual Test

Open `docs/manual-test-form.html` in Chrome, click the extension icon, then run `Identify & Fill`. New domains show a preview before filling unless the exact host is listed as trusted and one-click trusted fill is enabled.
