/**
 * BUG_20261115_suite-summary-reads-result-status-not-outcome: a `test.fail` test that fails as expected has result status
 * `failed` but test outcome `expected`; only `unexpected` is a failure. The summary tools count by outcome.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {isUnexpectedEvent, isUnexpectedReportTest, lastResult} from '../../../../scripts/lib/testOutcome.mjs';

describe('isUnexpectedEvent (telemetry test-end events)', () => {
  it('does not count a test.fail test that failed as expected', () => {
    assert.equal(isUnexpectedEvent({status: 'failed', expected: true}), false);
  });
  it('counts a plain failure, a timeout and a test.fail test that passed', () => {
    assert.equal(isUnexpectedEvent({status: 'failed', expected: false}), true);
    assert.equal(isUnexpectedEvent({status: 'timedOut', expected: false}), true);
    assert.equal(isUnexpectedEvent({status: 'passed', expected: false}), true);
  });
  it('does not count a pass or a skip', () => {
    assert.equal(isUnexpectedEvent({status: 'passed', expected: true}), false);
    assert.equal(isUnexpectedEvent({status: 'skipped', expected: true}), false);
  });
  it('falls back to the status for an old event with no expected field', () => {
    assert.equal(isUnexpectedEvent({status: 'failed'}), true);
    assert.equal(isUnexpectedEvent({status: 'passed'}), false);
  });
});

describe('isUnexpectedReportTest (Playwright JSON report tests)', () => {
  const test = (outcome: string, statuses: string[]) => ({outcome, results: statuses.map((status) => ({status}))});
  it('does not count an expected failure whose result status is failed', () => {
    assert.equal(isUnexpectedReportTest(test('expected', ['failed'])), false);
  });
  it('counts outcome unexpected, and a flaky test is not a failure', () => {
    assert.equal(isUnexpectedReportTest(test('unexpected', ['failed'])), true);
    assert.equal(isUnexpectedReportTest(test('flaky', ['failed', 'passed'])), false);
    assert.equal(isUnexpectedReportTest(test('skipped', ['skipped'])), false);
  });
  it('reads the last result when a report predates the outcome field', () => {
    assert.equal(isUnexpectedReportTest({results: [{status: 'failed'}]}), true);
    assert.equal(isUnexpectedReportTest({results: [{status: 'passed'}]}), false);
  });
  it('reads the last attempt', () => {
    assert.equal(lastResult(test('flaky', ['failed', 'passed'])), 'passed');
  });
});
