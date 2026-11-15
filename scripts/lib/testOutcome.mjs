// Which tests failed, by Playwright's outcome and not by result status (T815;
// bugs/BUG_20261115_suite-summary-reads-result-status-not-outcome.md).
//
// A `test.fail` test that fails as expected has result status `failed` but outcome `expected`; only `unexpected` is a
// failure (and a `test.fail` test that PASSES is unexpected). Main's red count was read as 67 when it was 59 real failures.
// Every tool that summarises a run counts through these two functions.

/** Last attempt's status of a JSON-report test, or undefined. */
export function lastResult(test) {
  return test.results?.[test.results.length - 1]?.status;
}

/** A telemetry `test-end` event (scripts/telemetry-reporter.mjs): `expected` is result.status === test.expectedStatus. */
export function isUnexpectedEvent(event) {
  if (typeof event.expected === 'boolean') return !event.expected;
  return event.status !== 'passed' && event.status !== 'skipped'; // an event written before `expected` existed
}

/** A test of the Playwright JSON report: `outcome` is expected | unexpected | flaky | skipped. */
export function isUnexpectedReportTest(test) {
  if (test.outcome !== undefined) return test.outcome === 'unexpected';
  const status = lastResult(test);
  return status !== undefined && status !== 'passed' && status !== 'skipped';
}
