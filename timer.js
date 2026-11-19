/* TRX Coach - timers opened from Home: Stopwatch (starts at once) or Intervals (editor, then run).
   Independent of the workout: no effect on progress, completion ping or stats. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  function A() { return window.TRXAPP || {}; }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // v2 settings: default 45s work / 15s rest / 3 rounds (old trx:timer:cfg values are dropped once).
  var DEF = { work: 45, rest: 15, rounds: 3 };
  var cfg = load("trx:timer:cfg2", null);
  if (!cfg || !(cfg.work > 0) || !(cfg.rest >= 0) || !(cfg.rounds > 0)) { cfg = { work: DEF.work, rest: DEF.rest, rounds: DEF.rounds }; save("trx:timer:cfg2", cfg); }
  try { localStorage.removeItem("trx:timer:cfg"); } catch (e) {}
  try { localStorage.removeItem("trx:timer:last"); } catch (e) {} // no menu any more
  var READY = 3;

  function phases() {
    var ph = [{ kind: "ready", label: "Ready", secs: READY }];
    for (var r = 1; r <= cfg.rounds; r++) {
      ph.push({ kind: "work", label: "Work", secs: cfg.work, round: r, of: cfg.rounds });
      if (r < cfg.rounds && cfg.rest > 0) ph.push({ kind: "rest", label: "Rest", secs: cfg.rest, round: r, of: cfg.rounds });
    }
    return ph;
  }

  // ---- Run engine ----
  var mode = null, ph = [], pi = 0, left = 0, remMs = 0, endAt = 0, running = false, timer = null, raf = 0,
      sw = false, swAcc = 0, swStart = 0, done = false;
  function fmt(s) { if (s < 60) return String(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60; return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (r < 10 ? "0" : "") + r; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function cue(kind) {
    var b = A().beep; if (!b) return;
    if (kind === "rest") { b(660, 0.35, 0.3); buzz(150); }
    else if (kind === "end") { b(784, 0.2, 0.35); setTimeout(function () { b(1046, 0.2, 0.35); }, 200); setTimeout(function () { b(1318, 0.45, 0.35); }, 400); buzz([200, 100, 200]); }
    else { b(1046, 0.18, 0.35); setTimeout(function () { b(1318, 0.3, 0.35); }, 180); buzz(250); }
  }
  function swMs() { return swAcc + (running ? Date.now() - swStart : 0); }
  // Ring: fraction of the current phase (intervals) or of the current minute (stopwatch).
  function ring() {
    var f;
    if (done) f = 1;
    else if (sw) f = (swMs() % 60000) / 60000;
    else { var p = ph[pi], tot = p ? p.secs * 1000 : 1, rem = running ? Math.max(0, endAt - Date.now()) : remMs; f = 1 - rem / tot; }
    f = Math.max(0, Math.min(1, f));
    var a = $("tArc"); a.style.strokeDashoffset = String(1 - f); a.style.visibility = f < 0.003 ? "hidden" : "visible";
  }
  function frame() { ring(); raf = running ? requestAnimationFrame(frame) : 0; }
  function begin() {
    sw = mode === "sw"; done = false; pi = 0; swAcc = 0;
    ph = sw ? [] : phases(); left = sw ? 0 : ph[0].secs; remMs = left * 1000;
    $("tEdit").hidden = true; $("tRun").hidden = false;
    play();
  }
  function play() {
    if (done) { begin(); return; }
    var app = A(); if (app.unlockAudio) app.unlockAudio();
    running = true;
    if (sw) swStart = Date.now(); else endAt = Date.now() + remMs;
    clearInterval(timer); timer = setInterval(tick, 100);
    if (!raf) raf = requestAnimationFrame(frame);
    if (app.acquireWake) app.acquireWake();
    render();
  }
  function pause() {
    if (sw && running) swAcc += Date.now() - swStart;
    if (!sw && running) remMs = Math.max(0, endAt - Date.now());
    running = false; clearInterval(timer);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    var app = A(); if (app.releaseWake) app.releaseWake(); if (app.maybeReload) app.maybeReload();
    render();
  }
  function toggle() { if ($("tRun").hidden) return; running ? pause() : play(); }
  function tick() {
    if (!running) return;
    if (sw) { var s = Math.floor(swMs() / 1000); if (s !== left) { left = s; render(); } return; }
    var l = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    if (l === left) return;
    left = l;
    if (l > 0 && l <= 3) { var b = A().beep; if (b) b(880, 0.12, 0.3); }
    if (l === 0) {
      if (pi + 1 >= ph.length) {
        running = false; clearInterval(timer); done = true; remMs = 0; cue("end");
        var app = A(); if (app.releaseWake) app.releaseWake(); if (app.maybeReload) app.maybeReload(); render(); return;
      }
      pi++; left = ph[pi].secs; remMs = left * 1000; endAt = Date.now() + remMs; cue(ph[pi].kind);
    }
    render();
  }
  // Same layout for both: state label, ring + digits, one hint line.
  function render() {
    var run = $("tRun"), p = ph[pi] || { kind: "work", label: "" };
    var t = done ? "\u2713" : fmt(left), te = $("tTime");
    te.textContent = t; te.classList.toggle("long", t.length > 2 && t.length <= 5); te.classList.toggle("xlong", t.length > 5);
    $("tState").textContent = done ? "Done" : sw ? "Elapsed" : p.label;
    var hint = "";
    if (done) hint = "Tap to restart";
    else if (!running) hint = "Paused \u00b7 tap to resume";
    else if (!sw && p.of) hint = "Round " + p.round + " of " + p.of;
    $("tHint").textContent = hint;
    run.classList.toggle("rest", !done && p.kind === "rest");
    run.classList.toggle("ready", !done && p.kind === "ready" && !sw);
    run.classList.toggle("paused", !running && !done);
    ring();
  }

  // ---- Intervals editor ----
  var FIELDS = [["Work", "work", 5, 5, 600, true], ["Rest", "rest", 5, 0, 600, true], ["Rounds", "rounds", 1, 1, 50, false]];
  function fv(v, isTime) { if (!isTime) return String(v); var m = Math.floor(v / 60), s = v % 60; return v < 60 ? v + "s" : m + ":" + (s < 10 ? "0" : "") + s; }
  function renderEditor() {
    var box = $("tFields"); box.innerHTML = "";
    FIELDS.forEach(function (f) {
      var row = document.createElement("div"); row.className = "tField";
      row.innerHTML = '<label></label><button class="tStep" type="button">&minus;</button><span class="v"></span><button class="tStep" type="button">+</button>';
      row.querySelector("label").textContent = f[0];
      row.querySelector(".v").textContent = fv(cfg[f[1]], f[5]);
      var bs = row.querySelectorAll(".tStep");
      bs[0].setAttribute("aria-label", "Less " + f[0].toLowerCase()); bs[1].setAttribute("aria-label", "More " + f[0].toLowerCase());
      bs[0].addEventListener("click", function () { cfg[f[1]] = Math.max(f[3], cfg[f[1]] - f[2]); save("trx:timer:cfg2", cfg); renderEditor(); });
      bs[1].addEventListener("click", function () { cfg[f[1]] = Math.min(f[4], cfg[f[1]] + f[2]); save("trx:timer:cfg2", cfg); renderEditor(); });
      box.appendChild(row);
    });
  }
  $("tGo").addEventListener("click", begin);
  $("tDial").addEventListener("click", toggle);
  $("tClose").addEventListener("click", function () { close(); });

  // open("sw"): stopwatch starts at once. open("intv"): the editor, then Start. × always returns Home.
  function open(m) {
    mode = m === "sw" ? "sw" : "intv";
    $("tTitle").textContent = mode === "sw" ? "Stopwatch" : "Intervals";
    $("timerPage").hidden = false;
    if (mode === "sw") begin();
    else { $("tRun").hidden = true; $("tEdit").hidden = false; renderEditor(); }
  }
  function close() {
    if (running) pause();
    done = false; mode = null;
    $("timerPage").hidden = true; $("tRun").hidden = true; $("tEdit").hidden = true;
  }
  window.TRXTimer = {
    open: open, close: close, toggle: toggle,
    isOpen: function () { return !$("timerPage").hidden; },
    isRunning: function () { return running; }
  };
})();
