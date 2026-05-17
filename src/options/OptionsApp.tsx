export function OptionsApp() {
  return (
    <main className="app-shell options-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Configuration</p>
          <h1>Bill AutoFill Options</h1>
        </div>
        <span className="status-pill">Not connected</span>
      </header>

      <section className="settings-grid">
        <div className="panel">
          <h2>AI provider</h2>
          <label>
            Provider
            <select defaultValue="openai">
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
              <option value="gemini">Gemini</option>
              <option value="custom">Custom OpenAI-compatible</option>
            </select>
          </label>
          <label>
            API key
            <input type="password" placeholder="Stored in Chrome extension storage" />
          </label>
          <label>
            Model
            <input type="text" defaultValue="gpt-4.1-mini" />
          </label>
          <button type="button" className="secondary-action">
            Test connection
          </button>
        </div>

        <div className="panel">
          <h2>Profile preferences</h2>
          <label>
            Preferred country
            <select defaultValue="US">
              <option value="US">United States</option>
              <option value="CA">Canada</option>
              <option value="GB">United Kingdom</option>
              <option value="AU">Australia</option>
              <option value="DE">Germany</option>
              <option value="FR">France</option>
              <option value="JP">Japan</option>
              <option value="SG">Singapore</option>
            </select>
          </label>
          <label>
            Gender
            <select defaultValue="any">
              <option value="any">Any</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="neutral">Neutral</option>
            </select>
          </label>
          <label>
            Fill behavior
            <select defaultValue="preview">
              <option value="preview">Preview before fill</option>
              <option value="trusted">One-click on trusted domains</option>
            </select>
          </label>
        </div>

        <div className="panel">
          <h2>Privacy and safety</h2>
          <p className="muted">
            Profiles are fictional test data. The extension sends only minimal field context to providers,
            never auto-submits forms, and does not send existing form values.
          </p>
          <button type="button" className="secondary-action">
            Clear stored settings
          </button>
        </div>
      </section>
    </main>
  );
}
