const SOUND_PATH = "/notification-tone.wav";

export async function playNotificationSound(): Promise<void> {
  if (typeof Audio === "undefined") return;

  const audio = new Audio(SOUND_PATH);
  audio.volume = 0.75;
  await audio.play();
}
