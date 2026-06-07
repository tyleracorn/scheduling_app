import { openDuePeriods, processExpiredTurns, processTurnWarnings } from "../services/draft.js";

const POLL_MS = 60_000;

let timer: ReturnType<typeof setInterval> | null = null;

async function tick() {
  try {
    await openDuePeriods();
    await processTurnWarnings();
    await processExpiredTurns();
  } catch (err) {
    console.error("[scheduler] tick failed:", err);
  }
}

export function startScheduler() {
  if (timer) return;
  void tick();
  timer = setInterval(() => void tick(), POLL_MS);
}

export function stopScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
