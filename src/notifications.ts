import { getSettings, saveSettings } from "./db";
import { generateQuestion } from "./llm";
import type { AppSettings, PracticeRecord } from "./types";

type NotificationHandler = (record: PracticeRecord) => void;

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
  if (running || document.hidden) return;
  running = true;
  try {
    const settings = await getSettings();
    if (!shouldSend(settings)) return;

    const permission = await requestNotificationPermission();
    if (permission !== "granted") return;

    const record = await generateQuestion(settings);
    const nextSettings: AppSettings = {
      ...settings,
      notification: {
        ...settings.notification,
        lastSentAt: new Date().toISOString()
      }
    };
    await saveSettings(nextSettings);
    await showQuestionNotification(record);
    onQuestion(record);
  } finally {
    running = false;
  }
}

function shouldSend(settings: AppSettings): boolean {
  const notification = settings.notification;
  if (!notification.enabled) return false;
  if (!isInsideWindow(notification.windowStart, notification.windowEnd)) return false;
  if (!notification.lastSentAt) return true;

  const elapsed = Date.now() - new Date(notification.lastSentAt).getTime();
  return elapsed >= notification.intervalMinutes * 60_000;
}

function isInsideWindow(start: string, end: string): boolean {
  const now = new Date();
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

async function showQuestionNotification(record: PracticeRecord): Promise<void> {
  const registration = await navigator.serviceWorker?.ready;
  const title = `Practice ${record.targetLanguage}`;
  const options: NotificationOptions = {
    body: record.question,
    icon: "/osmolingo-icon.svg",
    badge: "/favicon.svg",
    tag: `question-${record.id ?? Date.now()}`,
    data: { url: "/" }
  };

  if (registration?.showNotification) {
    await registration.showNotification(title, options);
    return;
  }

  new Notification(title, options);
}
