'use strict';

const { evaluate, evaluateRule } = require('../src/evaluator/rules');
const { computePeriod } = require('../src/evaluator/pipeline');

// ── evaluateRule ──────────────────────────────────────────────────────────────

describe('evaluateRule', () => {
  const metrics = { study_minutes: 300, physical_activity_sessions: 3 };

  test('passes when metric meets threshold (>=)', () => {
    const result = evaluateRule({ metric: 'study_minutes', operator: '>=', threshold: 300 }, metrics);
    expect(result.passed).toBe(true);
    expect(result.actual_value).toBe(300);
  });

  test('fails when metric is below threshold (>=)', () => {
    const result = evaluateRule({ metric: 'study_minutes', operator: '>=', threshold: 301 }, metrics);
    expect(result.passed).toBe(false);
  });

  test('treats missing metric as 0', () => {
    const result = evaluateRule({ metric: 'oral_evaluations', operator: '>=', threshold: 1 }, metrics);
    expect(result.actual_value).toBe(0);
    expect(result.passed).toBe(false);
  });

  test('supports > operator', () => {
    expect(evaluateRule({ metric: 'study_minutes', operator: '>', threshold: 299 }, metrics).passed).toBe(true);
    expect(evaluateRule({ metric: 'study_minutes', operator: '>', threshold: 300 }, metrics).passed).toBe(false);
  });

  test('throws on unknown operator', () => {
    expect(() => evaluateRule({ metric: 'study_minutes', operator: '!=', threshold: 0 }, metrics))
      .toThrow('Unknown operator');
  });
});

// ── evaluate (logic: all) ─────────────────────────────────────────────────────

describe('evaluate — logic: all', () => {
  const rules = [
    { metric: 'study_minutes',              operator: '>=', threshold: 300 },
    { metric: 'physical_activity_sessions', operator: '>=', threshold: 3   },
  ];

  test('pass when all rules pass', () => {
    const { result } = evaluate({ rules, logic: 'all', metrics: { study_minutes: 350, physical_activity_sessions: 4 } });
    expect(result).toBe('pass');
  });

  test('fail when any rule fails', () => {
    const { result } = evaluate({ rules, logic: 'all', metrics: { study_minutes: 299, physical_activity_sessions: 4 } });
    expect(result).toBe('fail');
  });

  test('rule_results includes per-rule detail', () => {
    const { rule_results } = evaluate({ rules, logic: 'all', metrics: { study_minutes: 350, physical_activity_sessions: 2 } });
    expect(rule_results[0].passed).toBe(true);
    expect(rule_results[1].passed).toBe(false);
  });
});

// ── evaluate (logic: any) ─────────────────────────────────────────────────────

describe('evaluate — logic: any', () => {
  const rules = [
    { metric: 'study_minutes',              operator: '>=', threshold: 300 },
    { metric: 'physical_activity_sessions', operator: '>=', threshold: 3   },
  ];

  test('pass when at least one rule passes', () => {
    const { result } = evaluate({ rules, logic: 'any', metrics: { study_minutes: 350, physical_activity_sessions: 1 } });
    expect(result).toBe('pass');
  });

  test('fail when no rules pass', () => {
    const { result } = evaluate({ rules, logic: 'any', metrics: { study_minutes: 100, physical_activity_sessions: 0 } });
    expect(result).toBe('fail');
  });
});

// ── computePeriod ─────────────────────────────────────────────────────────────

describe('computePeriod', () => {
  test('daily — returns yesterday', () => {
    const ref = new Date('2024-03-15T10:00:00Z'); // Friday
    const { periodStart, periodEnd } = computePeriod('daily', ref);
    expect(periodStart.toISOString().startsWith('2024-03-14')).toBe(true);
    expect(periodEnd.toISOString().startsWith('2024-03-14')).toBe(true);
  });

  test('weekly — returns Mon-Sun of the previous complete week', () => {
    // Reference: Wednesday 2024-03-20
    const ref = new Date('2024-03-20T10:00:00Z');
    const { periodStart, periodEnd } = computePeriod('weekly', ref);
    // Most recent complete Sun: 2024-03-17 (Sun)
    // Week start: Mon 2024-03-11
    expect(periodEnd.getUTCDay()).toBe(0);   // Sunday
    expect(periodStart.getUTCDay()).toBe(1); // Monday
    // Mon 00:00 → Sun 23:59:59 is ~7 days elapsed (6 full days + 1 day remainder)
    const diffDays = (periodEnd - periodStart) / (1000 * 60 * 60 * 24);
    expect(Math.round(diffDays)).toBe(7);
  });

  test('monthly — returns the previous calendar month', () => {
    const ref = new Date('2024-03-15T10:00:00Z');
    const { periodStart, periodEnd } = computePeriod('monthly', ref);
    expect(periodStart.getUTCMonth()).toBe(1); // February
    expect(periodEnd.getUTCMonth()).toBe(1);
  });

  test('throws on unknown period', () => {
    expect(() => computePeriod('quarterly', new Date())).toThrow('Unknown period');
  });
});
