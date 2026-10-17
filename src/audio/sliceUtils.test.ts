/**
 * Unit tests for the pure audio-slice helpers.
 */
import { describe, it, expect } from 'vitest';
import { formatTime, buildAudioLoopPlan } from './sliceUtils';

describe('formatTime', () => {
  it('formats zero', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('formats under a minute', () => {
    expect(formatTime(59.4)).toBe('0:59');
  });

  it('floors over a minute', () => {
    expect(formatTime(65.9)).toBe('1:05');
  });

  it('formats an hour as 60 minutes', () => {
    expect(formatTime(3600)).toBe('60:00');
  });

  it('clamps negatives to zero', () => {
    expect(formatTime(-5)).toBe('0:00');
  });
});

describe('buildAudioLoopPlan', () => {
  it('builds a normal plan with a gap', () => {
    const plan = buildAudioLoopPlan(2, 6, 1.5, 10);
    expect(plan.offset).toBe(2);
    expect(plan.duration).toBe(4);
    expect(plan.cycleDuration).toBe(5.5);
    expect(plan.loop).toBe(true);
  });

  it('swaps out-of-order start/end before clamping', () => {
    const plan = buildAudioLoopPlan(6, 2, 0, 10);
    expect(plan.offset).toBe(2);
    expect(plan.duration).toBe(4);
  });

  it('clamps a negative start to zero', () => {
    const plan = buildAudioLoopPlan(-1, 3, 0, 10);
    expect(plan.offset).toBe(0);
    expect(plan.duration).toBe(3);
  });

  it('clamps an end beyond the buffer duration', () => {
    const plan = buildAudioLoopPlan(8, 12, 0, 10);
    expect(plan.offset).toBe(8);
    expect(plan.duration).toBe(2);
  });

  it('marks zero and too-short slices as non-loopable', () => {
    expect(buildAudioLoopPlan(5, 5, 0, 10).loop).toBe(false);
    expect(buildAudioLoopPlan(5, 5.01, 0, 10).loop).toBe(false); // 0.01 < 0.05
    expect(buildAudioLoopPlan(5, 5.06, 0, 10).loop).toBe(true);  // 0.06 >= 0.05
  });

  it('treats a zero gap as a continuous loop', () => {
    const plan = buildAudioLoopPlan(1, 3, 0, 10);
    expect(plan.cycleDuration).toBe(plan.duration);
  });
});
