export type SimulateMode = 'slow' | 'error' | 'empty';

const MODES: readonly SimulateMode[] = ['slow', 'error', 'empty'];

// Demo switch so Loading / Error / Empty states can be shown on demand. Off when DEMO_SIMULATE=0.
export function simulateMode(url: URL): SimulateMode | null {
  if (process.env.DEMO_SIMULATE === '0') return null;
  const mode = url.searchParams.get('simulate');
  return MODES.includes(mode as SimulateMode) ? (mode as SimulateMode) : null;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
