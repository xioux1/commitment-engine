'use strict';

const OPERATORS = {
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
  '>':  (a, b) => a > b,
  '<':  (a, b) => a < b,
  '==': (a, b) => a === b,
};

/**
 * Evaluate a single rule against a flat metrics object.
 *
 * Rule shape:
 * {
 *   metric: 'study_minutes',   // key in metrics
 *   operator: '>=',
 *   threshold: 300,
 *   description: '…'          // optional, human-readable
 * }
 *
 * @param {object} rule
 * @param {object} metrics  Flat key→number map from Discriminador
 * @returns {{ rule, actual_value, passed: boolean }}
 */
function evaluateRule(rule, metrics) {
  const { metric, operator, threshold } = rule;

  const fn = OPERATORS[operator];
  if (!fn) throw new Error(`Unknown operator: "${operator}"`);

  const actual = metrics[metric];
  if (actual === undefined) {
    // Treat missing metric as 0 (conservative — counts as failure for >= checks)
    return { rule, actual_value: 0, passed: fn(0, threshold) };
  }

  return { rule, actual_value: actual, passed: fn(actual, threshold) };
}

/**
 * Evaluate all rules for a commitment against a metrics snapshot.
 *
 * @param {object[]} rules
 * @param {'all'|'any'} logic
 * @param {object} metrics   Flat key→number from Discriminador (.metrics property)
 * @returns {{
 *   rule_results: Array<{ rule, actual_value, passed }>,
 *   result: 'pass'|'fail'
 * }}
 */
function evaluate({ rules, logic, metrics }) {
  const rule_results = rules.map(rule => evaluateRule(rule, metrics));

  let passed;
  if (logic === 'all') {
    passed = rule_results.every(r => r.passed);
  } else if (logic === 'any') {
    passed = rule_results.some(r => r.passed);
  } else {
    throw new Error(`Unknown logic operator: "${logic}"`);
  }

  return {
    rule_results,
    result: passed ? 'pass' : 'fail',
  };
}

module.exports = { evaluate, evaluateRule };
