export function PopupApp() {
  return (
    <main className="app-shell popup-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Fictional test data</p>
          <h1>Bill AutoFill</h1>
        </div>
        <span className="status-pill">Preview mode</span>
      </header>

      <section className="panel">
        <dl className="preference-list">
          <div>
            <dt>Country</dt>
            <dd>United States</dd>
          </div>
          <div>
            <dt>Gender</dt>
            <dd>Any</dd>
          </div>
          <div>
            <dt>US tax preference</dt>
            <dd>No preference</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <h2>Ready</h2>
        <p className="muted">
          Identify visible billing fields, generate a fictional profile, and review mappings before filling.
        </p>
        <button type="button" className="primary-action">
          Identify & Fill
        </button>
      </section>

      <a className="text-link" href="/options.html" target="_blank" rel="noreferrer">
        Open Options
      </a>
    </main>
  );
}
