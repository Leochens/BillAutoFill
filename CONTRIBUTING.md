# Contributing

Thanks for helping improve Bill AutoFill.

## Development

```bash
npm install
npm test
npm run build
```

Load the generated `dist/` directory from `chrome://extensions` with Developer mode enabled.

## Pull Requests

- Keep the extension focused on fictional test data for QA, demos, and sandbox forms.
- Do not add behavior that submits forms automatically.
- Do not add support for payment card numbers, passwords, government IDs, or real identity documents.
- Keep permissions as narrow as possible.
- Add or update tests for form extraction, mapping validation, popup behavior, and options behavior when changing those areas.

## Manual Testing

Use `docs/manual-test-form.html` or another sandbox form. Confirm that the extension fills only reviewed fields and does not submit the form.
