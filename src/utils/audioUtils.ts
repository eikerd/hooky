/**
 * Audio utilities for playing notification sounds
 */

type BurntToastSound =
  | "Default"
  | "IM"
  | "Mail"
  | "Reminder"
  | "SMS"
  | "Alarm"
  | "Call"
  | "Call2"
  | "Call3"
  | "Call4"
  | "Call5"
  | "Call6"
  | "Call7"
  | "Call8"
  | "Call9"
  | "Call10";

/**
 * Generate a simple beep sound using Web Audio API
 */
function generateBeep(
  frequency: number = 800,
  duration: number = 200,
  volume: number = 0.3
): Promise<void> {
  return new Promise((resolve) => {
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + duration / 1000
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);

      setTimeout(resolve, duration + 50);
    } catch (error) {
      console.error("Audio playback error:", error);
      resolve();
    }
  });
}

/**
 * Play a notification sound based on BurntToast sound name
 */
export async function playNotificationSound(
  sound: BurntToastSound
): Promise<void> {
  try {
    // Map BurntToast sounds to frequencies and patterns
    const soundMap: Record<BurntToastSound, { freq: number; pattern: number[] }> = {
      Default: { freq: 800, pattern: [200] },
      IM: { freq: 1000, pattern: [100, 50, 100] },
      Mail: { freq: 1200, pattern: [150, 100, 150] },
      Reminder: { freq: 900, pattern: [300, 100, 300] },
      SMS: { freq: 1100, pattern: [100, 100, 100] },
      Alarm: { freq: 1400, pattern: [300, 200, 300, 200, 300] },
      Call: { freq: 950, pattern: [400, 200, 400] },
      Call2: { freq: 900, pattern: [300, 300, 300] },
      Call3: { freq: 1050, pattern: [250, 250, 250] },
      Call4: { freq: 850, pattern: [350, 350, 350] },
      Call5: { freq: 1150, pattern: [200, 200, 200] },
      Call6: { freq: 1000, pattern: [400, 100, 400] },
      Call7: { freq: 900, pattern: [300, 150, 300] },
      Call8: { freq: 1100, pattern: [250, 150, 250] },
      Call9: { freq: 950, pattern: [350, 150, 350] },
      Call10: { freq: 1050, pattern: [300, 100, 300, 100, 300] },
    };

    const soundConfig = soundMap[sound] || soundMap.Default;

    // Play the pattern
    for (const duration of soundConfig.pattern) {
      await generateBeep(soundConfig.freq, duration, 0.3);
      // Small delay between beeps
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  } catch (error) {
    console.error("Failed to play sound:", error);
  }
}

/**
 * Play a success sound (simple rising beep)
 */
export async function playSuccessSound(): Promise<void> {
  try {
    await generateBeep(600, 150, 0.2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await generateBeep(800, 150, 0.2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await generateBeep(1000, 150, 0.2);
  } catch (error) {
    console.error("Failed to play success sound:", error);
  }
}

/**
 * Play an error sound (falling beep)
 */
export async function playErrorSound(): Promise<void> {
  try {
    await generateBeep(1000, 200, 0.2);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await generateBeep(500, 200, 0.2);
  } catch (error) {
    console.error("Failed to play error sound:", error);
  }
}
