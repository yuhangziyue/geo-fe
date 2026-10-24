import { afterEach, describe, expect, it } from 'vitest';
import { simulateMode } from './simulate';

describe('simulateMode', () => {
  afterEach(() => {
    delete process.env.DEMO_SIMULATE;
  });

  it('reads a known mode from the query string', () => {
    expect(simulateMode(new URL('http://x/?simulate=error'))).toBe('error');
    expect(simulateMode(new URL('http://x/?simulate=slow'))).toBe('slow');
    expect(simulateMode(new URL('http://x/?simulate=empty'))).toBe('empty');
  });

  it('ignores unknown modes', () => {
    expect(simulateMode(new URL('http://x/?simulate=foo'))).toBeNull();
    expect(simulateMode(new URL('http://x/'))).toBeNull();
  });

  it('is disabled when DEMO_SIMULATE=0', () => {
    process.env.DEMO_SIMULATE = '0';
    expect(simulateMode(new URL('http://x/?simulate=error'))).toBeNull();
  });
});
