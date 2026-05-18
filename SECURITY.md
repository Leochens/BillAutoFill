# Security Policy

Bill AutoFill is intended for fictional test data and sandbox form-filling workflows.

## Reporting a Vulnerability

If you find a security issue, please do not publish exploit details first. Open a private security advisory on GitHub if available, or contact the maintainer through the repository's issue tracker with a high-level description.

Please include:

- Affected version or commit
- Browser and operating system
- Steps to reproduce
- Expected impact

## Data Handling Notes

- API keys are stored in Chrome extension local storage on the user's machine.
- Existing user-entered form values are not sent to AI providers.
- Field metadata such as labels, names, placeholders, nearby text, and select options may be sent to the provider configured by the user.
- Forms are never submitted automatically.
