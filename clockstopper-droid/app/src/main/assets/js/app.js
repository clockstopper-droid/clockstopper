'use strict';

/* ── DOM refs ────────────────────────────────────────────────────────────── */
const display      = document.getElementById('display');
const btnStartStop = document.getElementById('btnStartStop');
const btnLap       = document.getElementById('btnLap');
const btnReset     = document.getElementById('btnReset');
const lapList      = document.getElementById('lapList');
const lapsSection  = document.getElementById('lapsSection');

/* ── State ───────────────────────────────────────────────────────────────── */
let startTime   = 0;   // performance.now() value when timer last started
let elapsed     = 0;   // total ms accumulated before the last pause
let rafId       = null; // requestAnimationFrame handle
let running     = false;
let lapElapsed  = 0;   // elapsed ms at the time of the last lap
let lapCount    = 0;

/* ── Formatting ──────────────────────────────────────────────────────────── */
/**
 * Format milliseconds as  HH:MM:SS.mmm
 * @param {number} ms
 * @returns {string}
 */
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const millis  = Math.floor(ms % 1000);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours   = Math.floor(totalSeconds / 3600);

    return [
        String(hours).padStart(2, '0'),
        String(minutes).padStart(2, '0'),
        String(seconds).padStart(2, '0'),
    ].join(':') + '.' + String(millis).padStart(3, '0');
}

/* ── Render loop ─────────────────────────────────────────────────────────── */
function tick() {
    const now = elapsed + (performance.now() - startTime);
    display.textContent = formatTime(now);
    rafId = requestAnimationFrame(tick);
}

/* ── Controls ────────────────────────────────────────────────────────────── */
function start() {
    startTime = performance.now();
    running   = true;
    rafId     = requestAnimationFrame(tick);

    btnStartStop.textContent = 'Stop';
    btnStartStop.classList.replace('btn--primary', 'btn--danger');
    btnLap.disabled   = false;
    btnReset.disabled = true;
}

function stop() {
    elapsed += performance.now() - startTime;
    cancelAnimationFrame(rafId);
    rafId   = null;
    running = false;

    btnStartStop.textContent = 'Start';
    btnStartStop.classList.replace('btn--danger', 'btn--primary');
    btnLap.disabled   = true;
    btnReset.disabled = false;
}

function reset() {
    elapsed    = 0;
    lapElapsed = 0;
    lapCount   = 0;

    display.textContent  = '00:00:00.000';
    lapList.innerHTML    = '';
    lapsSection.hidden   = true;
    btnReset.disabled    = true;
    btnLap.disabled      = true;
    btnStartStop.textContent = 'Start';
    btnStartStop.classList.remove('btn--danger');
    btnStartStop.classList.add('btn--primary');
}

function lap() {
    if (!running) return;

    lapCount++;
    const now       = elapsed + (performance.now() - startTime);
    const split     = now - lapElapsed;
    lapElapsed      = now;

    const li = document.createElement('li');
    li.innerHTML =
        `<span class="lap-num">Lap ${lapCount}</span>` +
        `<span class="lap-time">${formatTime(now)}</span>` +
        `<span class="lap-split">+${formatTime(split)}</span>`;

    lapList.prepend(li);
    lapsSection.hidden = false;
}

/* ── Event listeners ─────────────────────────────────────────────────────── */
btnStartStop.addEventListener('click', () => running ? stop() : start());
btnLap.addEventListener('click',       lap);
btnReset.addEventListener('click',     reset);

/* Restore state from localStorage on page load (survives WebView recreation) */
(function restoreState() {
    try {
        const saved = localStorage.getItem('clockstopper_elapsed');
        if (saved !== null) {
            elapsed = parseFloat(saved) || 0;
            display.textContent = formatTime(elapsed);
            if (elapsed > 0) btnReset.disabled = false;
        }
    } catch (_) { /* storage unavailable */ }
})();

/* Persist elapsed time before the page unloads */
window.addEventListener('pagehide', () => {
    try {
        const current = running
            ? elapsed + (performance.now() - startTime)
            : elapsed;
        localStorage.setItem('clockstopper_elapsed', String(current));
    } catch (_) { /* storage unavailable */ }
});
