import { describe, expect, it } from "vitest";

import { buildProviderRequest } from "../src/shared/providers";
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
});
