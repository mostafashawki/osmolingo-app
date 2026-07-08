import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import { selectPrompt } from "./llm";
import {
  findActivePendingQuestion,
  findPendingQuestion,
  generateQuestionWithGuard,
  selectPromptForHistory
} from "./questionFlow";
import type { PracticeRecord, PromptId } from "./types";

describe("selectPrompt", () => {
  it("respects the configured 65/35 default prompt weights", () => {
    expect(selectPrompt(DEFAULT_SETTINGS.prompts, () => 0).id).toBe("business");
    expect(selectPrompt(DEFAULT_SETTINGS.prompts, () => 0.649).id).toBe("business");
    expect(selectPrompt(DEFAULT_SETTINGS.prompts, () => 0.65).id).toBe("everyday");
    expect(selectPrompt(DEFAULT_SETTINGS.prompts, () => 0.999).id).toBe("everyday");
  });
});

describe("question generation guard", () => {
  it("finds a pending unanswered question for history display helpers", () => {
    const pending = makeRecord({ id: 1, createdAt: "2026-07-08T09:00:00.000Z", correction: undefined });
    const answered = makeRecord({
      id: 2,
      createdAt: "2026-07-08T09:05:00.000Z",
      correction: {
        mark: 8,
        corrected: "Corrected",
        improved: "Improved",
        explanation: "Good"
      }
    });

    expect(findPendingQuestion([answered, pending])).toBe(pending);
  });

  it("blocks when the latest generated question is unanswered", async () => {
    const pending = makeRecord({ id: 2, createdAt: "2026-07-08T09:05:00.000Z" });
    const createQuestion = vi.fn(async () => makeRecord({ id: 2 }));

    const result = await generateQuestionWithGuard([pending], createQuestion);

    expect(result).toEqual({ status: "blocked", record: pending });
    expect(createQuestion).not.toHaveBeenCalled();
  });

  it("ignores older abandoned unanswered questions after a newer question is corrected", async () => {
    const abandoned = makeRecord({ id: 1, createdAt: "2026-07-08T09:00:00.000Z" });
    const answered = makeRecord({
      id: 2,
      createdAt: "2026-07-08T09:05:00.000Z",
      correction: {
        mark: 9,
        corrected: "Corrected",
        improved: "Improved",
        explanation: "Good"
      }
    });
    const next = makeRecord({ id: 3, createdAt: "2026-07-08T09:10:00.000Z" });
    const createQuestion = vi.fn(async () => next);

    const result = await generateQuestionWithGuard([abandoned, answered], createQuestion);

    expect(result).toEqual({ status: "created", record: next });
    expect(createQuestion).toHaveBeenCalledTimes(1);
  });

  it("uses only the latest question as the active pending question", () => {
    const abandoned = makeRecord({ id: 1, createdAt: "2026-07-08T09:00:00.000Z" });
    const answered = makeRecord({
      id: 2,
      createdAt: "2026-07-08T09:05:00.000Z",
      correction: {
        mark: 9,
        corrected: "Corrected",
        improved: "Improved",
        explanation: "Good"
      }
    });

    expect(findActivePendingQuestion([abandoned, answered])).toBeUndefined();
  });
});

describe("selectPromptForHistory", () => {
  it("balances mixed generation toward the configured prompt weights", () => {
    const records: PracticeRecord[] = [];
    const sequence: PromptId[] = [];

    for (let index = 0; index < 10; index += 1) {
      const promptId = selectPromptForHistory(DEFAULT_SETTINGS.prompts, records);
      sequence.push(promptId);
      records.unshift(makeRecord({ id: index + 1, promptId }));
    }

    expect(sequence).toEqual([
      "business",
      "everyday",
      "business",
      "business",
      "everyday",
      "business",
      "business",
      "everyday",
      "business",
      "business"
    ]);
  });
});

function makeRecord(overrides: Partial<PracticeRecord> = {}): PracticeRecord {
  return {
    id: 1,
    question: "Wie geht es dir?",
    hints: [],
    context: "Everyday",
    promptId: "everyday",
    userLanguage: "English",
    targetLanguage: "German",
    provider: "openai",
    model: "gpt-5.4-mini",
    bookmarked: false,
    createdAt: "2026-07-08T09:00:00.000Z",
    ...overrides
  };
}
