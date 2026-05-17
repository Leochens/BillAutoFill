import { useEffect, useState } from "react";
import { MESSAGE_TYPES } from "../shared/messages";
import type { BillingProfile, FieldMapping, FieldSnapshot, GeneratedProfileOption } from "../shared/types";

type PopupState =
  | { status: "ready" }
  | { status: "loading"; message: string }
  | {
      status: "permission";
      message: string;
      origin: string;
      action:
        | { type: "run" }
        | { type: "confirm"; profile: BillingProfile; mappings: FieldMapping[] };
    }
  | {
      status: "preview";
      profile: BillingProfile;
      fields: FieldSnapshot[];
      mappings: FieldMapping[];
    }
  | { status: "filled"; filled: number }
  | { status: "error"; message: string };

type AutofillResponse = {
  code?: string;
  error?: string;
  origin?: string;
  mode?: "preview" | "filled";
  profile?: BillingProfile;
  fields?: FieldSnapshot[];
  mappings?: FieldMapping[];
  fillResult?: { filled?: number };
  filled?: number;
};

type SettingsResponse = {
  settings?: {
    savedProfiles?: GeneratedProfileOption[];
    selectedProfileId?: string;
  };
};

function filledCount(response: AutofillResponse): number {
  return response.fillResult?.filled ?? response.filled ?? 0;
}

function needsHostPermission(response: AutofillResponse): response is AutofillResponse & { origin: string } {
  return response.code === MESSAGE_TYPES.NEED_HOST_PERMISSION && Boolean(response.origin);
}

async function requestSitePermission(origin: string): Promise<boolean> {
  return chrome.permissions.request({ origins: [origin] });
}

function describeField(field: FieldSnapshot): string {
  return [field.label, field.name, field.id].filter(Boolean).join(" / ") || field.fieldId;
}

function fieldForMapping(fields: FieldSnapshot[], mapping: FieldMapping): FieldSnapshot | undefined {
  return fields.find((field) => field.fieldId === mapping.fieldId);
}

export function PopupApp() {
  const [state, setState] = useState<PopupState>({ status: "ready" });
  const [savedProfiles, setSavedProfiles] = useState<GeneratedProfileOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("random");
  const loading = state.status === "loading";

  useEffect(() => {
    void Promise.resolve(chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_SETTINGS }))
      .then((response: SettingsResponse) => {
        if (!response?.settings) return;
        const profiles = response.settings?.savedProfiles ?? [];
        setSavedProfiles(profiles);
        setSelectedProfileId(response.settings?.selectedProfileId ?? "random");
      })
      .catch(() => {
        // Settings are optional for the popup; keep random fill available on failures.
      });
  }, []);

  async function runAutofill() {
    setState({ status: "loading", message: "Identifying billing fields..." });

    try {
      const response = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.RUN_AUTOFILL,
        profileOptionId: selectedProfileId === "random" ? undefined : selectedProfileId
      })) as AutofillResponse;

      if (needsHostPermission(response)) {
        setState({
          status: "permission",
          message: response.error ?? "Site permission is required before filling this page.",
          origin: response.origin,
          action: { type: "run" }
        });
        return;
      }

      if (response.error) {
        setState({ status: "error", message: response.error });
        return;
      }

      if (response.mode === "filled") {
        setState({ status: "filled", filled: filledCount(response) });
        return;
      }

      setState({
        status: "preview",
        profile: response.profile!,
        fields: response.fields ?? [],
        mappings: response.mappings ?? []
      });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  async function confirmFill() {
    if (state.status !== "preview") return;

    await fillReviewedFields(state.profile, state.mappings);
  }

  async function fillReviewedFields(profile: BillingProfile, mappings: FieldMapping[]) {
    setState({ status: "loading", message: "Filling reviewed fields..." });

    try {
      const response = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CONFIRM_FILL,
        profile,
        mappings
      })) as AutofillResponse;

      if (needsHostPermission(response)) {
        setState({
          status: "permission",
          message: response.error ?? "Site permission is required before filling this page.",
          origin: response.origin,
          action: { type: "confirm", profile, mappings }
        });
        return;
      }

      if (response.error) {
        setState({ status: "error", message: response.error });
        return;
      }

      setState({ status: "filled", filled: filledCount(response) });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  async function continueAfterPermission() {
    if (state.status !== "permission") return;

    const { origin, action } = state;
    setState({ status: "loading", message: "Requesting site permission..." });

    try {
      const granted = await requestSitePermission(origin);
      if (!granted) {
        setState({ status: "error", message: "Site permission was not granted." });
        return;
      }

      if (action.type === "run") {
        await runAutofill();
        return;
      }

      await fillReviewedFields(action.profile, action.mappings);
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div>
          <h1>Bill AutoFill</h1>
          <p className="popup-copy">Fictional test data for billing forms.</p>
        </div>
        <span className="status-pill">Test data</span>
      </header>

      <section className="panel workflow-panel">
        <h2>Ready</h2>
        <p className="muted">
          Identify visible billing fields, generate a fictional profile, and review mappings before filling.
        </p>
        {savedProfiles.length > 0 ? (
          <label className="compact-label">
            Fill profile
            <select
              value={selectedProfileId}
              onChange={(event) => setSelectedProfileId(event.target.value)}
            >
              <option value="random">Random address</option>
              {savedProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="button" className="primary-action" disabled={loading} onClick={runAutofill}>
          Identify & Fill
        </button>
      </section>

      {state.status === "loading" ? <p className="notice loading-notice">{state.message}</p> : null}

      {state.status === "permission" ? (
        <section className="notice permission-notice">
          <p>{state.message}</p>
          <button type="button" className="secondary-action" onClick={continueAfterPermission}>
            Allow current site & continue
          </button>
        </section>
      ) : null}

      {state.status === "error" ? <p className="notice error-notice">{state.message}</p> : null}

      {state.status === "filled" ? (
        <p className="notice filled-notice">
          Filled {state.filled} fields. The form was not submitted.
        </p>
      ) : null}

      {state.status === "preview" ? (
        <section className="panel preview-panel">
          <h2>Preview mapping</h2>
          <p className="profile-summary">
            {state.profile.givenName} {state.profile.familyName}, {state.profile.country}
          </p>
          <ul className="mapping-list">
            {state.mappings.map((mapping) => {
              const field = fieldForMapping(state.fields, mapping);
              return (
                <li key={`${mapping.fieldId}-${mapping.target}`}>
                  <span>{field ? describeField(field) : mapping.fieldId}</span>
                  <strong>{mapping.target}</strong>
                </li>
              );
            })}
          </ul>
          <button type="button" className="secondary-action" onClick={confirmFill}>
            Fill reviewed fields
          </button>
        </section>
      ) : null}

      <a className="text-link" href="/options.html" target="_blank" rel="noreferrer">
        Open Options
      </a>
    </main>
  );
}
