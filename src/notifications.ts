import { getSettings, listQuestions, saveSettings } from "./db";
import { generateQuestion } from "./llm";
import { findActivePendingQuestion, generateQuestionWithGuard, selectPromptForHistory } from "./questionFlow";
import { playNotificationSound } from "./sound";
import { formatElapsed } from "./time";
import type { AppSettings, PracticeRecord, PromptId } from "./types";

type NotificationKind = "new" | "reminder";
type NotificationHandler = (record: PracticeRecord, kind: NotificationKind) => void;
type PermissionRequester = () => Promise<NotificationPermission>;

let timer: number | undefined;
let running = false;

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

export function startNotificationScheduler(onQuestion: NotificationHandler): void {
  stopNotificationScheduler();
  timer = window.setInterval(() => {
    void tick(onQuestion);
  }, 60_000);
  void tick(onQuestion);
}

export function stopNotificationScheduler(): void {
  if (timer) window.clearInterval(timer);
  timer = undefined;
}

async function tick(onQuestion: NotificationHandler): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runNotificationTick(onQuestion);
  } finally {
    running = false;
  }
}

export async function runNotificationTick(
  onQuestion: NotificationHandler,
  deps: {
    getSettings: () => Promise<AppSettings>;
    listQuestions: () => Promise<PracticeRecord[]>;
    generateQuestion: (settings: AppSettings, promptId: PromptId) => Promise<PracticeRecord>;
    saveSettings: (settings: AppSettings) => Promise<void>;
    requestPermission: PermissionRequester;
    showNotification: (record: PracticeRecord, kind: NotificationKind, now: Date) => Promise<void>;
    playSound: () => Promise<void>;
    now: () => Date;
  } = {
    getSettings,
    listQuestions,
    generateQuestion,
    saveSettings,
    requestPermission: requestNotificationPermission,
    showNotification: showQuestionNotification,
    playSound: playNotificationSound,
    now: () => new Date()
  }
): Promise<void> {
  const settings = await deps.getSettings();
  const now = deps.now();
  if (!shouldSend(settings, now)) return;

  const records = await deps.listQuestions();
  const permission = await deps.requestPermission();
  if (permission !== "granted") return;

  const pending = findActivePendingQuestion(records);
  if (pending) {
    await saveNotificationSentAt(settings, now, deps.saveSettings);
    await deps.showNotification(pending, "reminder", now);
    await deps.playSound().catch(() => undefined);
    onQuestion(pending, "reminder");
    return;
  }

  const promptId = selectPromptForHistory(settings.prompts, records);
  const result = await generateQuestionWithGuard(records, () => deps.generateQuestion(settings, promptId));
  if (result.status === "blocked") return;

  await saveNotificationSentAt(settings, now, deps.saveSettings);
  await deps.showNotification(result.record, "new", now);
  await deps.playSound().catch(() => undefined);
  onQuestion(result.record, "new");
}

async function saveNotificationSentAt(
  settings: AppSettings,
  now: Date,
  save: (settings: AppSettings) => Promise<void>
): Promise<void> {
  await save({
    ...settings,
    notification: {
      ...settings.notification,
      lastSentAt: now.toISOString()
    }
  });
}

export function shouldSend(settings: AppSettings, now = new Date()): boolean {
  const notification = settings.notification;
  if (!notification.enabled) return false;
  if (!isInsideWindow(notification.windowStart, notification.windowEnd, now)) return false;
  if (!notification.lastSentAt) return true;

  const elapsed = now.getTime() - new Date(notification.lastSentAt).getTime();
  return elapsed >= notification.intervalMinutes * 60_000;
}

function isInsideWindow(start: string, end: string, now: Date): boolean {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

async function showQuestionNotification(record: PracticeRecord, kind: NotificationKind, now: Date): Promise<void> {
  const registration = await navigator.serviceWorker?.ready;
  const isReminder = kind === "reminder";
  const title = isReminder ? `Pending ${record.targetLanguage} practice` : `Practice ${record.targetLanguage}`;
  const options: NotificationOptions = {
    body: isReminder
      ? `You have an unanswered question from ${formatElapsed(record.createdAt, now)} ago: ${record.question}`
      : record.question,
    icon: "/osmolingo-icon.svg",
    badge: "/favicon.svg",
    tag: `${isReminder ? "pending" : "question"}-${record.id ?? Date.now()}`,
    data: { url: "/" }
  };

  if (registration?.showNotification) {
    await registration.showNotification(title, options);
    return;
  }

  new Notification(title, options);
}
