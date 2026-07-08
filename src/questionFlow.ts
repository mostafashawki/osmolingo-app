import type { PracticeRecord, PromptConfig, PromptId } from "./types";

export type GenerateQuestionResult =
  | {
      status: "created";
      record: PracticeRecord;
    }
  | {
      status: "blocked";
      record: PracticeRecord;
    };

export function isPendingQuestion(record: PracticeRecord): boolean {
  return !record.correction;
}

export function findPendingQuestion(records: PracticeRecord[]): PracticeRecord | undefined {
  return records.find(isPendingQuestion);
}

export function findActivePendingQuestion(records: PracticeRecord[]): PracticeRecord | undefined {
  const latest = latestQuestion(records);
  return latest && isPendingQuestion(latest) ? latest : undefined;
}

export async function generateQuestionWithGuard(
  records: PracticeRecord[],
  createQuestion: () => Promise<PracticeRecord>
): Promise<GenerateQuestionResult> {
  const pending = findActivePendingQuestion(records);
  if (pending) {
    return {
      status: "blocked",
      record: pending
    };
  }

  return {
    status: "created",
    record: await createQuestion()
  };
}

export function selectPromptForHistory(prompts: PromptConfig[], records: PracticeRecord[]): PromptId {
  const positivePrompts = prompts.filter((prompt) => prompt.weight > 0);
  const candidates = positivePrompts.length ? positivePrompts : prompts;
  if (!candidates.length) {
    throw new Error("At least one prompt is required.");
  }

  const candidateIds = new Set(candidates.map((prompt) => prompt.id));
  const counts = new Map<PromptId, number>();
  let relevantTotal = 0;

  for (const record of records) {
    if (!candidateIds.has(record.promptId)) continue;
    counts.set(record.promptId, (counts.get(record.promptId) ?? 0) + 1);
    relevantTotal += 1;
  }

  const totalWeight = candidates.reduce((sum, prompt) => sum + promptWeight(prompt, positivePrompts.length > 0), 0);
  const nextTotal = relevantTotal + 1;

  return candidates.reduce((best, prompt) => {
    const weight = promptWeight(prompt, positivePrompts.length > 0);
    const expectedAfterNext = (nextTotal * weight) / totalWeight;
    const currentCount = counts.get(prompt.id) ?? 0;
    const deficit = expectedAfterNext - currentCount;

    if (!best || deficit > best.deficit) {
      return { id: prompt.id, deficit };
    }

    return best;
  }, undefined as { id: PromptId; deficit: number } | undefined)!.id;
}

function promptWeight(prompt: PromptConfig, useConfiguredWeights: boolean): number {
  return useConfiguredWeights ? prompt.weight : 1;
}

function latestQuestion(records: PracticeRecord[]): PracticeRecord | undefined {
  return records.reduce<PracticeRecord | undefined>((latest, record) => {
    if (!latest) return record;
    if (record.createdAt > latest.createdAt) return record;
    if (record.createdAt === latest.createdAt && (record.id ?? 0) > (latest.id ?? 0)) return record;
    return latest;
  }, undefined);
}
