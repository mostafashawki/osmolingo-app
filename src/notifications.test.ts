import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import { runNotificationTick } from "./notifications";
import type { AppSettings, PracticeRecord } from "./types";

describe("notification scheduler", () => {
  it("sends a reminder without calling the model when a question is pending", async () => {
    const pending = makeRecord({ id: 1, createdAt: "2026-07-08T09:00:00.000Z" });
    const deps = makeDeps({
      listQuestions: vi.fn(async () => [pending])
    });
    const onQuestion = vi.fn();

    await runNotificationTick(onQuestion, deps);

    expect(deps.generateQuestion).not.toHaveBeenCalled();
    expect(deps.requestPermission).toHaveBeenCalledTimes(1);
    expect(deps.saveSettings).toHaveBeenCalledTimes(1);
    expect(deps.showNotification).toHaveBeenCalledWith(pending, "reminder", new Date("2026-07-08T10:00:00.000Z"));
    expect(deps.playSound).toHaveBeenCalledTimes(1);
    expect(onQuestion).toHaveBeenCalledWith(pending, "reminder");
  });

  it("generates a new question when only an older abandoned question is unanswered", async () => {
    const abandoned = makeRecord({ id: 1, createdAt: "2026-07-08T09:00:00.000Z" });
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
    const created = makeRecord({ id: 3, createdAt: "2026-07-08T10:00:00.000Z" });
    const deps = makeDeps({
      listQuestions: vi.fn(async () => [abandoned, answered]),
      generateQuestion: vi.fn(async () => created)
    });
    const onQuestion = vi.fn();

    await runNotificationTick(onQuestion, deps);

    expect(deps.generateQuestion).toHaveBeenCalledTimes(1);
    expect(deps.showNotification).toHaveBeenCalledWith(created, "new", new Date("2026-07-08T10:00:00.000Z"));
    expect(onQuestion).toHaveBeenCalledWith(created, "new");
  });

  it("generates, notifies, and plays sound when no question is pending", async () => {
    const created = makeRecord({ id: 2 });
    const deps = makeDeps({
      listQuestions: vi.fn(async () => []),
      generateQuestion: vi.fn(async () => created)
    });
    const onQuestion = vi.fn();

    await runNotificationTick(onQuestion, deps);

    expect(deps.requestPermission).toHaveBeenCalledTimes(1);
    expect(deps.generateQuestion).toHaveBeenCalledWith(expect.any(Object), "business");
    expect(deps.saveSettings).toHaveBeenCalledTimes(1);
    expect(deps.showNotification).toHaveBeenCalledWith(created, "new", new Date("2026-07-08T10:00:00.000Z"));
    expect(deps.playSound).toHaveBeenCalledTimes(1);
    expect(onQuestion).toHaveBeenCalledWith(created, "new");
  });
});

function makeDeps(
  overrides: Partial<Parameters<typeof runNotificationTick>[1]> = {}
): NonNullable<Parameters<typeof runNotificationTick>[1]> {
  return {
    getSettings: vi.fn(async () => ({
      ...DEFAULT_SETTINGS,
      notification: {
        ...DEFAULT_SETTINGS.notification,
        enabled: true,
        windowStart: "09:00",
        windowEnd: "17:00",
        intervalMinutes: 30
      }
    } satisfies AppSettings)),
    listQuestions: vi.fn(async () => []),
    generateQuestion: vi.fn(async (_settings: AppSettings, promptId: PracticeRecord["promptId"]) =>
      makeRecord({ promptId })
    ),
    saveSettings: vi.fn(async () => undefined),
    requestPermission: vi.fn(async () => "granted" as NotificationPermission),
    showNotification: vi.fn(async () => undefined),
    playSound: vi.fn(async () => undefined),
    now: () => new Date("2026-07-08T10:00:00.000Z"),
    ...overrides
  };
}

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
