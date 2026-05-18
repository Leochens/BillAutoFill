# Privacy

Bill AutoFill is a local-first Chrome extension for generating fictional billing profiles and filling test forms.

## What Is Stored Locally

The extension stores settings in Chrome extension local storage:

- AI provider configuration
- API key entered by the user
- Preferred country and gender options
- Trusted domains
- Saved fictional profiles

## What May Be Sent to AI Providers

When an AI provider is configured, Bill AutoFill may send safe form metadata to that provider so it can map page fields to fictional profile fields. This metadata can include:

- Field labels
- Field names and IDs
- Placeholder text
- Autocomplete attributes
- Nearby text
- Select options

The extension does not intentionally send existing user-entered form values, passwords, payment card values, hidden fields, or file inputs.

## What Is Not Collected

Bill AutoFill does not operate a developer backend, analytics service, ad network, or telemetry pipeline. The project does not sell user data or use user data for advertising.

## User Control

Users choose their AI provider and API key. Users can clear stored settings from the Options page or remove the extension from Chrome.

## Safety Boundary

Bill AutoFill is intended for QA, demos, sandbox forms, and privacy-preserving test workflows. It is not intended for real purchases, impersonation, tax avoidance, or submitting false information to real services.
