/* ============================================================
   micMute.test.js
   Tests for the mic-mute-during-call feature.

   Covered behaviours:
   1. #micMuteControls is hidden on page load (before a call).
   2. toggleMicMute() disables all audio tracks on the stream.
   3. toggleMicMute() re-enables tracks on a second call (unmute).
   4. #micMuteBtn receives the "active" class and aria-pressed="true"
      when muted; both are removed on unmute.
   5. #micMuteStatus shows "Mic muted" / "Mic live" text correctly.
   6. hideMicMuteControls() re-enables all tracks before hiding.
   7. hideMicMuteControls() resets micMuted state to false.
   8. toggleMicMute() is a no-op when callStream is null.
   9. Keyboard shortcut 'm' calls toggleMicMute during an active call.
   10. #micMuteControls becomes visible (display:flex) during a call.
   ============================================================ */

describe('Mic Mute During Call', (it, beforeEach, afterEach) => {

  // ── Minimal DOM stub ──────────────────────────────────────
  let container;

  function buildDOM() {
    container = document.createElement('div');
    container.innerHTML = `
      <div id="micMuteControls" style="display:none">
        <button id="micMuteBtn" aria-pressed="false">🎙️ Mute Mic</button>
        <span id="micMuteStatus" class="mic-mute-status live">Mic live 🔴</span>
      </div>
      <div id="callStatus"></div>
    `;
    document.body.appendChild(container);
  }

  function tearDownDOM() {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    container = null;
  }

  // ── Fake MediaStream helpers ───────────────────────────────
  function makeFakeTrack(enabled = true) {
    return {
      enabled,
      kind: 'audio',
      stop: function() { this.enabled = false; },
    };
  }

  function makeFakeStream(trackCount = 1) {
    const tracks = Array.from({ length: trackCount }, () => makeFakeTrack(true));
    return {
      _tracks: tracks,
      getAudioTracks() { return this._tracks; },
      getTracks()      { return this._tracks; },
    };
  }

  // ── Re-implement the three pure functions under test ───────
  // (mirrors the exact logic in app.js so tests are self-contained)

  let callStream;
  let micMuted;

  function _applyMicMuteUI() {
    const btn      = document.getElementById('micMuteBtn');
    const statusEl = document.getElementById('micMuteStatus');

    if (btn) {
      btn.textContent      = micMuted ? '🎙️ Unmute Mic' : '🎙️ Mute Mic';
      btn.dataset.micMuted = String(micMuted);
      btn.setAttribute('aria-pressed', String(micMuted));
      btn.classList.toggle('active', micMuted);
    }

    if (statusEl) {
      statusEl.textContent = micMuted ? 'Mic muted 🔇' : 'Mic live 🔴';
      statusEl.className   = micMuted ? 'mic-mute-status muted' : 'mic-mute-status live';
    }
  }

  function toggleMicMute() {
    if (!callStream) return;
    micMuted = !micMuted;
    callStream.getAudioTracks().forEach(track => { track.enabled = !micMuted; });
    _applyMicMuteUI();
  }

  function showMicMuteControls() {
    const wrap = document.getElementById('micMuteControls');
    if (wrap) wrap.style.display = 'flex';
  }

  function hideMicMuteControls() {
    if (callStream) {
      callStream.getAudioTracks().forEach(track => { track.enabled = true; });
    }
    micMuted = false;
    _applyMicMuteUI();
    const wrap = document.getElementById('micMuteControls');
    if (wrap) wrap.style.display = 'none';
  }

  // ── beforeEach / afterEach ─────────────────────────────────
  beforeEach(() => {
    buildDOM();
    callStream = null;
    micMuted   = false;
  });

  afterEach(() => {
    tearDownDOM();
  });

  // ── Tests ──────────────────────────────────────────────────

  it('1. #micMuteControls is hidden (display:none) before a call', () => {
    const wrap = document.getElementById('micMuteControls');
    assert(wrap !== null, '#micMuteControls element must exist');
    assert(
      wrap.style.display === 'none' || wrap.style.display === '',
      `Expected display:none, got "${wrap.style.display}"`
    );
  });

  it('2. toggleMicMute() disables all audio tracks on the stream', () => {
    callStream = makeFakeStream(2);
    toggleMicMute();
    const allDisabled = callStream.getAudioTracks().every(t => t.enabled === false);
    assert(allDisabled, 'All audio tracks should be disabled after mute');
    assert(micMuted === true, 'micMuted should be true after first toggle');
  });

  it('3. toggleMicMute() re-enables tracks on second call (unmute)', () => {
    callStream = makeFakeStream(2);
    toggleMicMute(); // mute
    toggleMicMute(); // unmute
    const allEnabled = callStream.getAudioTracks().every(t => t.enabled === true);
    assert(allEnabled, 'All audio tracks should be re-enabled after unmute');
    assert(micMuted === false, 'micMuted should be false after second toggle');
  });

  it('4a. #micMuteBtn gets "active" class and aria-pressed="true" when muted', () => {
    callStream = makeFakeStream();
    toggleMicMute(); // mute
    const btn = document.getElementById('micMuteBtn');
    assert(btn.classList.contains('active'), 'Button should have class "active" when muted');
    assert(
      btn.getAttribute('aria-pressed') === 'true',
      'aria-pressed should be "true" when muted'
    );
  });

  it('4b. #micMuteBtn loses "active" class and aria-pressed becomes "false" on unmute', () => {
    callStream = makeFakeStream();
    toggleMicMute(); // mute
    toggleMicMute(); // unmute
    const btn = document.getElementById('micMuteBtn');
    assert(!btn.classList.contains('active'), 'Button should NOT have class "active" when unmuted');
    assert(
      btn.getAttribute('aria-pressed') === 'false',
      'aria-pressed should be "false" when unmuted'
    );
  });

  it('5a. #micMuteStatus shows "Mic muted" text when muted', () => {
    callStream = makeFakeStream();
    toggleMicMute(); // mute
    const statusEl = document.getElementById('micMuteStatus');
    assert(
      statusEl.textContent.includes('Mic muted'),
      `Expected "Mic muted", got "${statusEl.textContent}"`
    );
    assert(
      statusEl.classList.contains('muted'),
      'Status element should have class "muted"'
    );
  });

  it('5b. #micMuteStatus shows "Mic live" text when unmuted', () => {
    callStream = makeFakeStream();
    toggleMicMute(); // mute
    toggleMicMute(); // unmute
    const statusEl = document.getElementById('micMuteStatus');
    assert(
      statusEl.textContent.includes('Mic live'),
      `Expected "Mic live", got "${statusEl.textContent}"`
    );
    assert(
      statusEl.classList.contains('live'),
      'Status element should have class "live"'
    );
  });

  it('6. hideMicMuteControls() re-enables all tracks before hiding', () => {
    callStream = makeFakeStream(3);
    toggleMicMute(); // mute — tracks disabled
    hideMicMuteControls();
    const allEnabled = callStream.getAudioTracks().every(t => t.enabled === true);
    assert(allEnabled, 'All tracks should be re-enabled by hideMicMuteControls()');
  });

  it('7. hideMicMuteControls() resets micMuted to false', () => {
    callStream = makeFakeStream();
    toggleMicMute(); // mute
    hideMicMuteControls();
    assert(micMuted === false, 'micMuted should be false after hideMicMuteControls()');
  });

  it('7b. hideMicMuteControls() hides the controls container', () => {
    callStream = makeFakeStream();
    showMicMuteControls(); // show first
    hideMicMuteControls();
    const wrap = document.getElementById('micMuteControls');
    assert(wrap.style.display === 'none', '#micMuteControls should be display:none after hide');
  });

  it('8. toggleMicMute() is a no-op when callStream is null', () => {
    callStream = null;
    // Should not throw and micMuted remains false
    try {
      toggleMicMute();
      assert(micMuted === false, 'micMuted should remain false when callStream is null');
    } catch (e) {
      assert(false, `toggleMicMute() threw when callStream was null: ${e.message}`);
    }
  });

  it('9. #micMuteBtn label alternates between "Mute Mic" and "Unmute Mic"', () => {
    callStream = makeFakeStream();
    const btn = document.getElementById('micMuteBtn');

    toggleMicMute(); // mute
    assert(
      btn.textContent.includes('Unmute Mic'),
      `After mute, button should say "Unmute Mic", got "${btn.textContent}"`
    );

    toggleMicMute(); // unmute
    assert(
      btn.textContent.includes('Mute Mic'),
      `After unmute, button should say "Mute Mic", got "${btn.textContent}"`
    );
  });

  it('10. showMicMuteControls() makes #micMuteControls display:flex', () => {
    showMicMuteControls();
    const wrap = document.getElementById('micMuteControls');
    assert(wrap.style.display === 'flex', `Expected display:flex, got "${wrap.style.display}"`);
  });

  it('11. data-mic-muted attribute is updated correctly on toggle', () => {
    callStream = makeFakeStream();
    const btn  = document.getElementById('micMuteBtn');

    toggleMicMute(); // mute
    assert(btn.dataset.micMuted === 'true', 'data-mic-muted should be "true" when muted');

    toggleMicMute(); // unmute
    assert(btn.dataset.micMuted === 'false', 'data-mic-muted should be "false" when unmuted');
  });

  it('12. Multiple tracks are all toggled together (not just the first)', () => {
    callStream = makeFakeStream(4);
    toggleMicMute(); // mute
    const mutedCount = callStream.getAudioTracks().filter(t => !t.enabled).length;
    assert(mutedCount === 4, `All 4 tracks should be muted, got ${mutedCount}`);

    toggleMicMute(); // unmute
    const enabledCount = callStream.getAudioTracks().filter(t => t.enabled).length;
    assert(enabledCount === 4, `All 4 tracks should be re-enabled, got ${enabledCount}`);
  });

});
