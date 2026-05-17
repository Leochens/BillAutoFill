import { describe, expect, it } from "vitest";

import { buildProfileOptionsRequest, buildProviderRequest } from "../src/shared/providers";
import type { FieldSnapshot } from "../src/shared/types";

describe("buildProviderRequest", () => {
  it("builds an OpenAI chat completion request without field values", () => {
    const request = buildProviderRequest(
      { provider: "openai", apiKey: "sk-test", model: "gpt-4.1-mini" },
      [
        {
          fieldId: "field-0",
          tagName: "input",
          label: "First name",
          value: "do-not-send",
        },
      ] as unknown as FieldSnapshot[],
    );

    expect(request.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(JSON.stringify(request.body)).toContain("Return strict JSON");
    expect(JSON.stringify(request.body)).not.toContain("do-not-send");
  });

  it("normalizes custom provider base URLs before appending chat completions", () => {
    const request = buildProviderRequest(
      {
        provider: "custom",
        apiKey: "key",
        model: "model",
        baseUrl: " https://proxy.example.com/// ",
      },
      [],
    );

    expect(request.url).toBe("https://proxy.example.com/chat/completions");
  });

  it("throws a clear error when custom provider base URL is missing", () => {
    expect(() =>
      buildProviderRequest(
        {
          provider: "custom",
          apiKey: "key",
          model: "model",
          baseUrl: "   ",
        },
        [],
      ),
    ).toThrow("Custom provider base URL is required");
  });

  it("builds a fictional profile options request", () => {
    const request = buildProfileOptionsRequest(
      { provider: "openai", apiKey: "sk-test", model: "gpt-4.1-mini" },
      { countryCode: "US", gender: "neutral", preferTaxExemptState: true },
      4
    );

    expect(JSON.stringify(request.body)).toContain("Generate 4 fictional billing profiles");
    expect(JSON.stringify(request.body)).toContain("Return strict JSON");
    expect(JSON.stringify(request.body)).toContain("AK, DE, MT, NH, or OR");
  });
});
