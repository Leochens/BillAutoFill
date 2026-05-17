import { useEffect, useState } from "react";
import { COUNTRY_DEFINITIONS } from "../shared/countries";
import { MESSAGE_TYPES } from "../shared/messages";
import type {
  AutofillTraceStep,
  BillingProfile,
  FieldMapping,
  FieldSnapshot,
  GeneratedProfileOption
} from "../shared/types";

type PopupState =
  | { status: "ready" }
  | { status: "loading"; message: string }
  | {
      status: "permission";
      message: string;
      origin: string;
      action:
        | { type: "run" }
        | { type: "confirm"; profile: BillingProfile; mappings: FieldMapping[]; trace: AutofillTraceStep[] };
    }
  | {
      status: "preview";
      profile: BillingProfile;
      fields: FieldSnapshot[];
      mappings: FieldMapping[];
      trace: AutofillTraceStep[];
    }
  | { status: "filled"; filled: number; trace: AutofillTraceStep[] }
  | { status: "error"; message: string };

type AutofillResponse = {
  code?: string;
  error?: string;
  origin?: string;
  mode?: "preview" | "filled";
  profile?: BillingProfile;
  fields?: FieldSnapshot[];
  mappings?: FieldMapping[];
  trace?: AutofillTraceStep[];
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

function mappingReason(mapping: FieldMapping): string {
  const confidence = `${Math.round(mapping.confidence * 100)}%`;
  return mapping.note ? `${mapping.note} Confidence ${confidence}.` : `Confidence ${confidence}.`;
}

export function PopupApp() {
  const [state, setState] = useState<PopupState>({ status: "ready" });
  const [savedProfiles, setSavedProfiles] = useState<GeneratedProfileOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("random");
  const loading = state.status === "loading";
  const [customProfileText, setCustomProfileText] = useState("");
  const customProfileResult = parseProfileText(customProfileText);
  const selectedSavedProfile = savedProfiles.find((profile) => profile.id === selectedProfileId);
  const visibleProfile = customProfileResult.profile ?? selectedSavedProfile?.profile;

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
    if (customProfileResult.error) {
      setState({ status: "error", message: customProfileResult.error });
      return;
    }

    setState({ status: "loading", message: "Identifying billing fields..." });

    try {
      const request = {
        type: MESSAGE_TYPES.RUN_AUTOFILL,
        ...(customProfileResult.profile
          ? { profileOverride: customProfileResult.profile }
          : selectedProfileId === "random"
            ? { profileOptionId: "random" }
            : { profileOptionId: selectedProfileId })
      };
      const response = (await chrome.runtime.sendMessage(request)) as AutofillResponse;

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
        setState({
          status: "filled",
          filled: filledCount(response),
          trace: response.trace ?? []
        });
        return;
      }

      setState({
        status: "preview",
        profile: response.profile!,
        fields: response.fields ?? [],
        mappings: response.mappings ?? [],
        trace: response.trace ?? []
      });
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  async function confirmFill() {
    if (state.status !== "preview") return;

    await fillReviewedFields(state.profile, state.mappings, state.trace);
  }

  async function fillReviewedFields(
    profile: BillingProfile,
    mappings: FieldMapping[],
    previousTrace: AutofillTraceStep[] = []
  ) {
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
          action: { type: "confirm", profile, mappings, trace: previousTrace }
        });
        return;
      }

      if (response.error) {
        setState({ status: "error", message: response.error });
        return;
      }

      setState({
        status: "filled",
        filled: filledCount(response),
        trace: [
          ...previousTrace,
          ...(response.trace ?? []),
          {
            title: "Fill completed",
            detail: `Filled ${filledCount(response)} reviewed fields. The form was not submitted.`
          }
        ]
      });
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

      await fillReviewedFields(action.profile, action.mappings, action.trace);
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
        {visibleProfile ? <ProfileDetails profile={visibleProfile} /> : null}
        <label className="compact-label">
          Paste profile JSON
          <textarea
            rows={6}
            value={customProfileText}
            placeholder={profileJsonExample()}
            onChange={(event) => setCustomProfileText(event.target.value)}
          />
        </label>
        {customProfileResult.error ? (
          <p className="inline-error">{customProfileResult.error}</p>
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
        <>
          <p className="notice filled-notice">
            Filled {state.filled} fields. The form was not submitted.
          </p>
          <ProcessPanel trace={state.trace} />
        </>
      ) : null}

      {state.status === "preview" ? (
        <section className="panel preview-panel">
          <h2>Preview mapping</h2>
          <p className="profile-summary">
            {state.profile.givenName} {state.profile.familyName}, {state.profile.country}
          </p>
          <ProcessPanel trace={state.trace} />
          <ul className="mapping-list">
            {state.mappings.map((mapping) => {
              const field = fieldForMapping(state.fields, mapping);
              return (
                <li key={`${mapping.fieldId}-${mapping.target}`}>
                  <div>
                    <span>{field ? describeField(field) : mapping.fieldId}</span>
                    <small>{mappingReason(mapping)}</small>
                  </div>
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

function ProcessPanel({ trace }: { trace: AutofillTraceStep[] }) {
  if (trace.length === 0) return null;

  return (
    <details className="process-panel" open>
      <summary>AI process</summary>
      <ol>
        {trace.map((step, index) => (
          <li key={`${step.title}-${index}`}>
            <strong>{step.title}</strong>
            <span>{step.detail}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

function parseProfileText(text: string): { profile?: BillingProfile; error?: string } {
  const trimmed = text.trim();
  if (!trimmed) return {};

  try {
    const parsed = JSON.parse(trimmed) as { profile?: unknown } | unknown;
    const candidate = typeof parsed === "object" && parsed !== null && "profile" in parsed
      ? (parsed as { profile?: unknown }).profile
      : parsed;
    return { profile: coerceProfile(candidate) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not parse profile JSON." };
  }
}

function coerceProfile(value: unknown): BillingProfile {
  if (typeof value !== "object" || value === null) {
    throw new Error("Profile must be a JSON object.");
  }

  const profile = value as Partial<BillingProfile>;
  const required: Array<keyof BillingProfile> = [
    "givenName",
    "familyName",
    "gender",
    "streetLine1",
    "city",
    "region",
    "regionCode",
    "postalCode",
    "country",
    "countryCode",
    "phone",
    "email"
  ];
  const missing = required.filter((field) => !profile[field]);
  if (missing.length > 0) {
    throw new Error(`Missing profile fields: ${missing.join(", ")}.`);
  }
  if (!COUNTRY_DEFINITIONS[profile.countryCode as BillingProfile["countryCode"]]) {
    throw new Error("countryCode is not supported.");
  }

  return profile as BillingProfile;
}

function profileJsonExample(): string {
  return JSON.stringify({
    givenName: "Alex",
    familyName: "Bennett",
    gender: "neutral",
    streetLine1: "123 Maple Street",
    city: "Portland",
    region: "Oregon",
    regionCode: "OR",
    postalCode: "97201",
    country: "United States",
    countryCode: "US",
    phone: "+1 555 123 4567",
    email: "alex.bennett@example.test",
    company: "Northstar Labs"
  }, null, 2);
}

function ProfileDetails({ profile }: { profile: BillingProfile }) {
  const rows = [
    ["Name", `${profile.givenName} ${profile.familyName}`],
    ["Address", profile.streetLine1],
    ["City", profile.city],
    ["Region", `${profile.region} (${profile.regionCode})`],
    ["Postal", profile.postalCode],
    ["Country", `${profile.country} (${profile.countryCode})`],
    ["Phone", profile.phone],
    ["Email", profile.email],
    ["Gender", profile.gender],
    ["Company", profile.company ?? ""]
  ].filter(([, value]) => value);

  return (
    <dl className="profile-detail-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
