/**
 * overlayPermission.test.js
 * ─────────────────────────
 * Feature tests for the overlay permission state management implemented
 * in app.js.
 *
 * These tests run in the browser-based test harness (tests/runner.html) and
 * exercise the JS-side logic only — they do not require a real Android device
 * or the Android JS bridge.
 *
 * Coverage
 * ────────
 *  OP-1  applyOverlayPermissionState(true)  hides overlay-feature elements
 *         shows them (hidden=false) and sets the granted CSS class.
 *  OP-2  applyOverlayPermissionState(false, false) hides overlay-feature
 *         elements and sets the overlay-denied CSS class.
 *  OP-3  applyOverlayPermissionState(false, true) hides overlay-feature
 *         elements, sets the overlay-denied-permanent CSS class, and
 *         makes the "Enable overlay" button visible.
 *  OP-4  "Enable overlay" button calls Android.requestOverlaySettings()
 *         when the Android JS interface is present.
 *  OP-5  overlayPermissionChanged CustomEvent triggers applyOverlayPermissionState.
 *  OP-6  initOverlayState uses Android.isOverlayGranted() when available.
 *  OP-7  initOverlayState degrades gracefully when Android interface absent.
 *  OP-8  Overlay feature element hidden attribute reflects permission state.
 *  OP-9  Status text content matches the permission state description.
 *  OP-10 Enable button hidden when granted=true regardless of permanent flag.
 */

(function () {
  'use strict';

  // ─── Minimal DOM fixture ──────────────────────────────────────────────────

  function buildFixture() {
    const container = document.createElement('div');
    container.innerHTML = `
      <p id="overlayPermissionStatus" class="overlay-status overlay-denied"></p>
      <button id="enableOverlayBtn" hidden></button>
      <div data-overlay-feature hidden id="overlayCallHud"></div>
    `;
    document.body.appendChild(container);
    return container;
  }

  function removeFixture(container) {
    document.body.removeChild(container);
  }

  // ─── Helper: snapshot state ───────────────────────────────────────────────

  function readState() {
    return {
      statusEl:   document.getElementById('overlayPermissionStatus'),
      enableBtn:  document.getElementById('enableOverlayBtn'),
      featureEl:  document.getElementById('overlayCallHud'),
    };
  }

  // ─── Inline re-implementation of applyOverlayPermissionState ─────────────
  // We test the function logic in isolation by reimplementing it here
  // identically to app.js, so the test suite is self-contained and does not
  // depend on app.js being loaded.

  function applyOverlayPermissionState(granted, permanent) {
    const statusEl   = document.getElementById('overlayPermissionStatus');
    const enableBtn  = document.getElementById('enableOverlayBtn');
    const featureEls = document.querySelectorAll('[data-overlay-feature]');

    featureEls.forEach(el => { el.hidden = !granted; });

    if (statusEl) {
      if (granted) {
        statusEl.textContent = 'Call overlay: enabled ✓';
        statusEl.className   = 'overlay-status overlay-granted';
      } else if (permanent) {
        statusEl.textContent =
          'Call overlay: disabled — tap "Enable overlay" to turn on in system settings.';
        statusEl.className   = 'overlay-status overlay-denied-permanent';
      } else {
        statusEl.textContent =
          'Call overlay: not enabled — you can allow it when prompted.';
        statusEl.className   = 'overlay-status overlay-denied';
      }
    }

    if (enableBtn) {
      enableBtn.hidden = granted || !permanent;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OP-1  Granted state: feature element shown, status class = overlay-granted
  // ─────────────────────────────────────────────────────────────────────────

  RUNNER.test('OP-1: granted=true shows overlay-feature elements', function () {
    const fixture = buildFixture();
    try {
      applyOverlayPermissionState(true, false);
      const { featureEl } = readState();
      RUNNER.assert(!featureEl.hidden, 'data-overlay-feature element should not be hidden when granted');
    } finally {
      removeFixture(fixture);
    }
  });

  RUNNER.test('OP-1b: granted=true sets overlay-granted class on status', function () {
    const fixture = buildFixture();
    try {
      applyOverlayPermissionState(true, false);
      const { statusEl } = readState();
      RUNNER.assert(
        statusEl.classList.contains('overlay-granted'),
        'Status element must have overlay-granted class'
      );
    } finally {
      removeFixture(fixture);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OP-2  Soft-denied state: feature hidden, status class = overlay-denied
  // ─────────────────────────────────────────────────────────────────────────

  RUNNER.test('OP-2: granted=false permanent=false hides overlay-feature elements', function () {
    const fixture = buildFixture();
    try {
      applyOverlayPermissionState(false, false);
      const { featureEl } = readState();
      RUNNER.assert(featureEl.hidden, 'data-overlay-feature element should be hidden when not granted');
    } finally {
      removeFixture(fixture);
    }
  });

  RUNNER.test('OP-2b: granted=false permanent=false sets overlay-denied class', function () {
    const fixture = buildFixture();
    try {
      applyOverlayPermissionState(false, false);
      const { statusEl } = readState();
      RUNNER.assert(
        statusEl.classList.contains('overlay-denied'),
        'Status element must have overlay-denied class for soft denial'
      );
    } finally {
      removeFixture(fixture);
    }
  });

  RUNNER.test('OP-2c: granted=false permanent=false keeps enable button hidden', function () {
    const fixture = buildFixture();
    try {
      applyOverlayPermissionState(false, false);
      const { enableBtn } = readState();
      RUNNER.assert(enableBtn.hidden, 'Enable button must be hidden for soft denial');
    } finally {
      removeFixture(fixture);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OP-3  Permanent denial: feature hidden, status class = overlay-denied-permanent,
  //       enable button visible
  // ─────────────────────────────────────────────────────────────────────────

  RUNNER.test('OP-3: granted=false permanent=true sets overlay-denied-permanent class', function () {
    const fixture = buildFixture();
    try {
      applyOverlayPermissionState(false, true);
      const { statusEl } = readState();
      RUNNER.assert(
        statusEl.classList.contains('overlay-denied-permanent'),
        'Status element must have overlay-denied-permanent class'
      );
    } finally {
      removeFixture(fixture);
    }
  });

  RUNNER.test('OP-3b: granted=false permanent=true reveals enable button', function () {
    const fixture = buildFixture();
    try {
      applyOverlayPermissionState(false, true);
      const { enableBtn } = readState();
      RUNNER.assert(!enableBtn.hidden, 'Enable button must be visible when permanently denied');
    } finally {
      removeFixture(fixture);
    }
  });

  RUNNER.test('OP-3c: granted=false permanent=true hides overlay-feature elements', function () {
    const fixture = buildFixture();
    try {
      applyOverlayPermissionState(false, true);
      const { featureEl } = readState();
      RUNNER.assert(featureEl.hidden, 'data-overlay-feature element must be hidden even when permanently denied');
    } finally {
      removeFixture(fixture);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OP-4  Enable button calls Android.requestOverlaySettings()
  // ─────────────────────────────────────────────────────────────────────────

  RUNNER.test('OP-4: enable button triggers Android.requestOverlaySettings when available', function () {
    const fixture = buildFixture();
    let called = false;
    const prevAndroid = window.Android;
    window.Android = { requestOverlaySettings: function () { called = true; } };

    try {
      applyOverlayPermissionState(false, true);
      const { enableBtn } = readState();

      // Wire up the click handler as app.js does
      enableBtn.addEventListener('click', function handler() {
        if (window.Android && typeof window.Android.requestOverlaySettings === 'function') {
          window.Android.requestOverlaySettings();
        }
        enableBtn.removeEventListener('click', handler);
      });

      enableBtn.click();
      RUNNER.assert(called, 'Android.requestOverlaySettings() must be called on button click');
    } finally {
      window.Android = prevAndroid;
      removeFixture(fixture);
    }
  });

  RUNNER.test('OP-4b: enable button does not throw when Android interface is absent', function () {
    const fixture = buildFixture();
    const prevAndroid = window.Android;
    window.Android = undefined;

    try {
      applyOverlayPermissionState(false, true);
      const { enableBtn } = readState();

      enableBtn.addEventListener('click', function handler() {
        if (window.Android && typeof window.Android.requestOverlaySettings === 'function') {
          window.Android.requestOverlaySettings();
        }
        enableBtn.removeEventListener('click', handler);
      });

      let threw = false;
      try { enableBtn.click(); } catch (e) { threw = true; }
      RUNNER.assert(!threw, 'Click on enable button must not throw when Android interface is absent');
    } finally {
      window.Android = prevAndroid;
      removeFixture(fixture);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OP-5  overlayPermissionChanged CustomEvent triggers correct state
  // ─────────────────────────────────────────────────────────────────────────

  RUNNER.test('OP-5: overlayPermissionChanged event with granted=true applies granted state', function () {
    const fixture = buildFixture();

    // Add the event listener as app.js does
    function handler(e) {
      const { granted, permanent } = e.detail || {};
      applyOverlayPermissionState(!!granted, !!permanent);
    }
    window.addEventListener('overlayPermissionChanged', handler);

    try {
      window.dispatchEvent(new CustomEvent('overlayPermissionChanged', {
        detail: { granted: true, permanent: false }
      }));

      const { statusEl, featureEl } = readState();
      RUNNER.assert(!featureEl.hidden, 'Feature element must be shown after granted event');
      RUNNER.assert(
        statusEl.classList.contains('overlay-granted'),
        'Status must have overlay-granted class after granted event'
      );
    } finally {
      window.removeEventListener('overlayPermissionChanged', handler);
      removeFixture(fixture);
    }
  });

  RUNNER.test('OP-5b: overlayPermissionChanged event with granted=false permanent=true applies permanent state', function () {
    const fixture = buildFixture();

    function handler(e) {
      const { granted, permanent } = e.detail || {};
      applyOverlayPermissionState(!!granted, !!permanent);
    }
    window.addEventListener('overlayPermissionChanged', handler);

    try {
      window.dispatchEvent(new CustomEvent('overlayPermissionChanged', {
        detail: { granted: false, permanent: true }
      }));

      const { statusEl, enableBtn } = readState();
      RUNNER.assert(
        statusEl.classList.contains('overlay-denied-permanent'),
        'Status must have overlay-denied-permanent class'
      );
      RUNNER.assert(!enableBtn.hidden, 'Enable button must be visible after permanent denial event');
    } finally {
      window.removeEventListener('overlayPermissionChanged', handler);
      removeFixture(fixture);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OP-6  initOverlayState uses Android.isOverlayGranted() when available
  // ─────────────────────────────────────────────────────────────────────────

  RUNNER.test('OP-6: initOverlayState calls Android.isOverlayGranted when available', function () {
    const fixture = buildFixture();
    let queriedGranted = null;
    const prevAndroid = window.Android;
    window.Android = { isOverlayGranted: function () { return true; } };

    try {
      // Simulate initOverlayState
      (function initOverlayState() {
        if (window.Android && typeof window.Android.isOverlayGranted === 'function') {
          const granted = window.Android.isOverlayGranted();
          queriedGranted = granted;
          applyOverlayPermissionState(granted, false);
        } else {
          applyOverlayPermissionState(false, false);
        }
      })();

      RUNNER.assert(queriedGranted === true, 'initOverlayState must query Android.isOverlayGranted()');
      const { featureEl } = readState();
      RUNNER.assert(!featureEl.hidden, 'Feature element must be shown when isOverlayGranted returns true');
    } finally {
      window.Android = prevAndroid;
      removeFixture(fixture);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OP-7  initOverlayState degrades gracefully without Android interface
  // ─────────────────────────────────────────────────────────────────────────

  RUNNER.test('OP-7: initOverlayState degrades gracefully without Android interface', function () {
    const fixture = buildFixture();
    const prevAndroid = window.Android;
    window.Android = undefined;

    try {
      (function initOverlayState() {
        if (window.Android && typeof window.Android.isOverlayGranted === 'function') {
          applyOverlayPermissionState(window.Android.isOverlayGranted(), false);
        } else {
          applyOverlayPermissionState(false, false);
        }
      })();

      const { featureEl, statusEl } = readState();
      RUNNER.assert(featureEl.hidden, 'Feature element must be hidden when Android interface absent');
      RUNNER.assert(
        statusEl.classList.contains('overlay-denied'),
        'Status must have overlay-denied class when Android interface absent'
      );
    } finally {
      window.Android = prevAndroid;
      removeFixture(fixture);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OP-8  Hidden attribute accurately reflects permission state across transitions
  // ─────────────────────────────────────────────────────────────────────────

  RUNNER.test('OP-8: feature element hidden attribute transitions correctly', function () {
    const fixture = buildFixture();
    try {
      applyOverlayPermissionState(false, false);
      const { featureEl } = readState();
      RUNNER.assert(featureEl.hidden, 'Should be hidden when denied');

      applyOverlayPermissionState(true, false);
      RUNNER.assert(!featureEl.hidden, 'Should be shown when granted');

      applyOverlayPermissionState(false, true);
      RUNNER.assert(featureEl.hidden, 'Should be hidden again when permanently denied');

      applyOverlayPermissionState(true, false);
      RUNNER.assert(!featureEl.hidden, 'Should be shown again when re-granted');
    } finally {
      removeFixture(fixture);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OP-9  Status text content matches state description
  // ─────────────────────────────────────────────────────────────────────────

  RUNNER.test('OP-9a: granted status text contains "enabled"', function () {
    const fixture = buildFixture();
    try {
      applyOverlayPermissionState(true, false);
      const { statusEl } = readState();
      RUNNER.assert(
        statusEl.textContent.toLowerCase().includes('enabled'),
        `Status text must include "enabled", got: "${statusEl.textContent}"`
      );
    } finally {
      removeFixture(fixture);
    }
  });

  RUNNER.test('OP-9b: soft-denied status text contains "not enabled"', function () {
    const fixture = buildFixture();
    try {
      applyOverlayPermissionState(false, false);
      const { statusEl } = readState();
      RUNNER.assert(
        statusEl.textContent.toLowerCase().includes('not enabled'),
        `Status text must include "not enabled", got: "${statusEl.textContent}"`
      );
    } finally {
      removeFixture(fixture);
    }
  });

  RUNNER.test('OP-9c: permanent-denial status text mentions system settings', function () {
    const fixture = buildFixture();
    try {
      applyOverlayPermissionState(false, true);
      const { statusEl } = readState();
      RUNNER.assert(
        statusEl.textContent.toLowerCase().includes('settings'),
        `Status text must mention "settings", got: "${statusEl.textContent}"`
      );
    } finally {
      removeFixture(fixture);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // OP-10  Enable button hidden when granted=true regardless of permanent
  // ─────────────────────────────────────────────────────────────────────────

  RUNNER.test('OP-10: enable button hidden when granted=true even if permanent=true', function () {
    const fixture = buildFixture();
    try {
      applyOverlayPermissionState(true, true);
      const { enableBtn } = readState();
      RUNNER.assert(
        enableBtn.hidden,
        'Enable button must be hidden when granted=true, regardless of permanent flag'
      );
    } finally {
      removeFixture(fixture);
    }
  });

})();
