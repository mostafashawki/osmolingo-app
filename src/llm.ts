import { addQuestion, updateQuestion } from "./db";
import type {
  AppSettings,
  CorrectionResult,
  GeneratedQuestion,
  PracticeRecord,
  PromptConfig,
  PromptId,
  ProviderModel
} from "./types";

export function selectPrompt(prompts: PromptConfig[], random: () => number = Math.random): PromptConfig {
  const enabled = prompts.filter((prompt) => prompt.weight > 0);
  const pool = enabled.length ? enabled : prompts;
  if (!pool.length) {
    throw new Error("At least one prompt is required.");
  }

  if (!enabled.length) {
    const index = Math.min(pool.length - 1, Math.floor(random() * pool.length));
    return pool[index];
  }

  const total = pool.reduce((sum, prompt) => sum + prompt.weight, 0);
  let pick = Math.min(0.999999999, Math.max(0, random())) * total;

  for (const prompt of pool) {
    if (pick < prompt.weight) return prompt;
    pick -= prompt.weight;
  }

  return pool[pool.length - 1];
}

export function selectedModel(settings: AppSettings): ProviderModel {
  return settings.models.find((model) => model.id === settings.selectedModelId) ?? settings.models[0];
}

export async function generateQuestion(settings: AppSettings, promptId?: PromptId): Promise<PracticeRecord> {
  const prompt = promptId
    ? settings.prompts.find((item) => item.id === promptId) ?? selectPrompt(settings.prompts)
    : selectPrompt(settings.prompts);
  const model = selectedModel(settings);

  const result = await callLlm<GeneratedQuestion>({
    provider: model.provider,
    model: model.model,
    system: prompt.text,
    user: [
      `User language: ${settings.userLanguage}`,
      `Target language: ${settings.targetLanguage}`,
      "Create exactly one practice question now."
    ].join("\n")
  });

  const record: PracticeRecord = {
    question: requireText(result.question, "question"),
    hints: normalizeHints(result.hints),
    context: typeof result.context === "string" ? result.context : prompt.name,
    promptId: prompt.id,
    userLanguage: settings.userLanguage,
    targetLanguage: settings.targetLanguage,
    provider: model.provider,
    model: model.model,
    bookmarked: false,
    createdAt: new Date().toISOString()
  };

  const id = await addQuestion(record);
  return { ...record, id };
}

export async function correctAnswer(
  settings: AppSettings,
  record: PracticeRecord,
  answer: string
): Promise<CorrectionResult> {
  const model = selectedModel(settings);
  const result = await callLlm<CorrectionResult>({
    provider: model.provider,
    model: model.model,
    system: settings.correctionPrompt,
    user: [
      `User language: ${settings.userLanguage}`,
      `Target language: ${settings.targetLanguage}`,
      `Question: ${record.question}`,
      `Learner answer: ${answer}`
    ].join("\n")
  });

  const correction: CorrectionResult = {
    mark: clampMark(result.mark),
    corrected: requireText(result.corrected, "corrected"),
    improved: requireText(result.improved, "improved"),
    explanation: requireText(result.explanation, "explanation")
  };

  if (record.id) {
    await updateQuestion(record.id, {
      answer,
      correction,
      answeredAt: new Date().toISOString()
    });
  }

  return correction;
}

async function callLlm<T>(body: {
  provider: string;
  model: string;
  system: string;
  user: string;
}): Promise<T> {
  const response = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error ?? "The model request failed.";
    throw new Error(message);
  }

  return parseJsonPayload<T>(payload?.text);
}

function parseJsonPayload<T>(text: unknown): T {
  if (typeof text !== "string") {
    throw new Error("The model returned an empty response.");
  }

  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
    }
    throw new Error("The model did not return valid JSON.");
  }
}

function normalizeHints(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, 5);
}

function requireText(value: unknown, key: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new Error(`The model response is missing "${key}".`);
}

function clampMark(value: unknown): number {
  const mark = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(mark)) return 0;
  return Math.max(0, Math.min(10, Math.round(mark)));
}
