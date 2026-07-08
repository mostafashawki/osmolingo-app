import { afterEach, describe, expect, it, vi } from "vitest";
import { playNotificationSound } from "./sound";

describe("playNotificationSound", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("plays the local notification tone", async () => {
    const play = vi.fn(async () => undefined);
    const audioInstances: Array<{ src: string; volume: number; play: typeof play }> = [];

    vi.stubGlobal(
      "Audio",
      class {
        src: string;
        volume = 1;
        play = play;

        constructor(src: string) {
          this.src = src;
          audioInstances.push(this);
        }
      }
    );

    await playNotificationSound();

    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0].src).toBe("/notification-tone.wav");
    expect(audioInstances[0].volume).toBe(0.75);
    expect(play).toHaveBeenCalledTimes(1);
  });
});
