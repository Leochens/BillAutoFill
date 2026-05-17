import { useEffect, useState } from "react";
import { COUNTRY_DEFINITIONS } from "../shared/countries";
import { DEFAULT_SETTINGS, SETTINGS_KEY, loadSettings, saveSettings } from "../shared/storage";
import type { CountryCode, ExtensionSettings, GenderPreference, ProviderKind } from "../shared/types";

function trustedDomainsText(domains: string[]): string {
  return domains.join("\n");
}

function parseTrustedDomains(value: string): string[] {
  return value
    .split("\n")
    .map((domain) => domain.trim())
    .filter(Boolean);
}

export function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState("Settings are stored locally in this browser extension.");

  useEffect(() => {
    void loadSettings().then(setSettings).catch((error) => {
      setStatus(error instanceof Error ? error.message : "Could not load settings.");
    });
  }, []);

  function updateProvider(provider: ProviderKind) {
    setSettings((current) => ({
      ...current,
      provider: { ...current.provider, provider }
    }));
  }

  function updateProviderField(field: "apiKey" | "model" | "baseUrl", value: string) {
    setSettings((current) => ({
      ...current,
      provider: { ...current.provider, [field]: value }
    }));
  }

  async function save() {
    await saveSettings(settings);
    setStatus("Saved.");
  }

  async function clearSettings() {
    await chrome.storage.local.remove(SETTINGS_KEY);
    setSettings(DEFAULT_SETTINGS);
    setStatus("Cleared stored settings.");
  }

  function testConnection() {
    if (!settings.provider.apiKey.trim()) {
      setStatus("Add an API key before testing the provider.");
      return;
    }

    setStatus(`Ready to test ${settings.provider.provider} with the current unsaved settings.`);
  }

  return (
    <main className="app-shell options-shell">
      <header className="app-header">
        <div>
          <h1>Bill AutoFill Options</h1>
          <p className="muted options-intro">Configure provider, country, and fill preferences.</p>
        </div>
        <span className="status-pill">{settings.provider.apiKey ? "Configured" : "Not connected"}</span>
      </header>

      <section className="settings-grid">
        <div className="panel">
          <h2>AI Provider</h2>
          <label>
            Provider
            <select
              value={settings.provider.provider}
              onChange={(event) => updateProvider(event.target.value as ProviderKind)}
            >
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
              <option value="gemini">Gemini</option>
              <option value="custom">Custom OpenAI-compatible</option>
            </select>
          </label>
          <label>
            API key
            <input
              type="password"
              value={settings.provider.apiKey}
              placeholder="Stored in Chrome extension storage"
              onChange={(event) => updateProviderField("apiKey", event.target.value)}
            />
          </label>
          <label>
            Model
            <input
              type="text"
              value={settings.provider.model}
              onChange={(event) => updateProviderField("model", event.target.value)}
            />
          </label>
          <label>
            Base URL
            <input
              type="url"
              value={settings.provider.baseUrl ?? ""}
              placeholder="Required for custom providers"
              onChange={(event) => updateProviderField("baseUrl", event.target.value)}
            />
          </label>
          <button type="button" className="secondary-action" onClick={testConnection}>
            Test connection
          </button>
        </div>

        <div className="panel">
          <h2>Profile preferences</h2>
          <label>
            Preferred country
            <select
              value={settings.countryCode}
              onChange={(event) =>
                setSettings({ ...settings, countryCode: event.target.value as CountryCode })
              }
            >
              {Object.values(COUNTRY_DEFINITIONS).map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Gender
            <select
              value={settings.gender}
              onChange={(event) =>
                setSettings({ ...settings, gender: event.target.value as GenderPreference })
              }
            >
              <option value="any">Any</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="neutral">Neutral</option>
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.preferTaxExemptState}
              onChange={(event) =>
                setSettings({ ...settings, preferTaxExemptState: event.target.checked })
              }
            />
            Prefer US tax-exempt states when country is United States
          </label>
          <label>
            Fill behavior
            <select
              value={settings.fillMode}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  fillMode: event.target.value as ExtensionSettings["fillMode"]
                })
              }
            >
              <option value="preview">Preview before filling on every domain</option>
              <option value="oneClickTrusted">One-click fill only on trusted exact hosts</option>
            </select>
          </label>
          <label>
            Trusted domains
            <textarea
              rows={4}
              value={trustedDomainsText(settings.trustedDomains)}
              placeholder="example.com"
              onChange={(event) =>
                setSettings({ ...settings, trustedDomains: parseTrustedDomains(event.target.value) })
              }
            />
          </label>
        </div>

        <div className="panel">
          <h2>Privacy and safety</h2>
          <p className="muted">
            Profiles are fictional test data. The extension sends only minimal field context to providers,
            never auto-submits forms, and does not send existing form values.
          </p>
          <button type="button" className="primary-action" onClick={save}>
            Save settings
          </button>
          <button type="button" className="secondary-action" onClick={clearSettings}>
            Clear stored settings
          </button>
          <p className="notice loading-notice" role="status">
            {status}
          </p>
        </div>
      </section>
    </main>
  );
}
