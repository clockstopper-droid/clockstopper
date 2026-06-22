/**
 * runner.js — Vanilla JS test runner for the Global Time Clock feature suite.
 *
 * Exposes a single global `RUNNER` object used by each feature test file:
 *
 *   RUNNER.test(name, fn)   — register and immediately run a test
 *   RUNNER.assert(cond, msg)— throw if cond is falsy (used inside test fns)
 *   RUNNER.finish()         — render the summary after all test files have run
 *
 * No external framework required — drop this file and the feature test files
 * into a directory served by any static file server (or open runner.html
 * directly from the file system).
 */

(function () {
  'use strict';

  var results = [];   // { name, passed, message }
  var groups  = [];   // { label, startIndex } — used for visual grouping

  /** Register the current feature file's name as a group heading. */
  function beginGroup(label) {
    groups.push({ label: label, startIndex: results.length });
  }

  /**
   * Run a single test.
   *
   * @param {string}   name  Human-readable test name (shown in output).
   * @param {Function} fn    Test body — call RUNNER.assert() inside it.
   */
  function test(name, fn) {
    var passed  = false;
    var message = '';
    try {
      fn();
      passed  = true;
      message = 'OK';
    } catch (e) {
      passed  = false;
      message = e && e.message ? e.message : String(e);
    }
    results.push({ name: name, passed: passed, message: message });
  }

  /**
   * Assertion helper.  Throws an Error with [msg] if [condition] is falsy.
   *
   * @param {*}      condition  Value to test for truthiness.
   * @param {string} [msg]      Description of what was expected.
   */
  function assert(condition, msg) {
    if (!condition) {
      throw new Error(msg || 'Assertion failed');
    }
  }

  /**
   * Equality assertion.
   *
   * @param {*}      actual    Actual value.
   * @param {*}      expected  Expected value (compared with ===).
   * @param {string} [msg]     Optional description.
   */
  function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error(
        (msg ? msg + ' — ' : '') +
        'Expected ' + JSON.stringify(expected) +
        ' but got '  + JSON.stringify(actual)
      );
    }
  }

  /**
   * Render all test results into the page and update the summary bar.
   * Call once, after all feature test files have been loaded and run.
   */
  function finish() {
    var passCount = results.filter(function (r) { return r.passed; }).length;
    var failCount = results.length - passCount;

    // Summary
    var summaryEl = document.getElementById('summary');
    if (summaryEl) {
      summaryEl.innerHTML =
        '<span class="pass">✓ ' + passCount + ' passed</span>' +
        (failCount > 0
          ? '&emsp;<span class="fail">✗ ' + failCount + ' failed</span>'
          : '') +
        '&emsp;<span style="color:#888">(' + results.length + ' total)</span>';
    }

    // Individual results
    var container = document.getElementById('results-container');
    if (!container) return;

    // Build a group → results map for visual sectioning
    var groupMap = {};
    groups.forEach(function (g) { groupMap[g.startIndex] = g.label; });

    results.forEach(function (r, idx) {
      // Insert group heading if this result starts a new group
      if (groupMap[idx]) {
        var h = document.createElement('h2');
        h.textContent = groupMap[idx];
        container.appendChild(h);
      }

      var div = document.createElement('div');
      div.className = 'test-result ' + (r.passed ? 'passed' : 'failed');

      var icon = r.passed ? '✓' : '✗';
      div.innerHTML =
        '<span class="name">' + icon + ' ' + escapeHtml(r.name) + '</span>' +
        (r.passed
          ? ''
          : '<span class="message">' + escapeHtml(r.message) + '</span>');

      container.appendChild(div);
    });

    // Set page title to summary for quick tab-level status
    document.title =
      (failCount > 0 ? '✗ ' + failCount + ' FAILED' : '✓ All passing') +
      ' — Global Time Clock Tests';
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;');
  }

  // ─── Expose global RUNNER ─────────────────────────────────────────────────

  window.RUNNER = {
    test:       test,
    assert:     assert,
    assertEqual: assertEqual,
    beginGroup: beginGroup,
    finish:     finish,
  };

})();
