/* TRX Coach - extra timer page (countdowns, Tabata, EMOM, intervals, stopwatch).
   Independent of the workout: no effect on progress, completion ping or stats. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  function A() { return window.TRXAPP || {}; }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var cfg = load("trx:timer:cfg", { cdx: 180, emomMin: 8, work: 40, rest: 20, rounds: 6 });
  var last = load("trx:timer:last", null);
  var READY = 3;

  // Build a phase list for a preset id.
  function phases(p) {
    var ph = [];
    function ready() { ph.push({ kind: "ready", label: "Ready", secs: READY }); }
    if (p.indexOf("cd") === 0) {
      var s = p === "cdx" ? cfg.cdx : +p.slice(2);
      ready(); ph.push({ kind: "work", label: "Go", secs: s, round: 1, of: 1 });
    } else if (p === "tabata") {
      ready(); for (var i = 1; i <= 8; i++) { ph.push({ kind: "work", label: "Work", secs: 20, round: i, of: 8 }); if (i < 8) ph.push({ kind: "rest", label: "Rest", secs: 10, round: i, of: 8 }); }
    } else if (p === "emom") {
      ready(); for (var m = 1; m <= cfg.emomMin; m++) ph.push({ kind: "work", label: "Minute " + m, secs: 60, round: m, of: cfg.emomMin });
    } else if (p === "intv") {
      ready(); for (var r = 1; r <= cfg.rounds; r++) { ph.push({ kind: "work", label: "Work", secs: cfg.work, round: r, of: cfg.rounds }); if (r < cfg.rounds) ph.push({ kind: "rest", label: "Rest", secs: cfg.rest, round: r, of: cfg.rounds }); }
    }
    return ph;
  }

  // ---- Run engine ----
  var preset = null, ph = [], pi = 0, left = 0, endAt = 0, running = false, timer = null, sw = false, swAcc = 0, swStart = 0, done = false;
  function fmt(s) { if (s < 60) return String(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60; return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (r < 10 ? "0" : "") + r; }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function cue(kind) {
    var b = A().beep; if (!b) return;
    if (kind === "rest") { b(660, 0.35, 0.3); buzz(150); }
    else if (kind === "end") { b(784, 0.2, 0.35); setTimeout(function () { b(1046, 0.2, 0.35); }, 200); setTimeout(function () { b(1318, 0.45, 0.35); }, 400); buzz([200, 100, 200]); }
    else { b(1046, 0.18, 0.35); setTimeout(function () { b(1318, 0.3, 0.35); }, 180); buzz(250); }
  }
  function start(p) {
    preset = p; last = p; save("trx:timer:last", p);
    sw = p === "sw"; done = false; pi = 0; swAcc = 0;
    ph = sw ? [] : phases(p); left = sw ? 0 : ph[0].secs;
    $("tMenu").hidden = true; $("tRun").hidden = false;
    play();
  }
  function play() {
    if (done) { start(preset); return; }
    var app = A(); if (app.unlockAudio) app.unlockAudio();
    running = true;
    if (sw) swStart = Date.now(); else endAt = Date.now() + left * 1000;
    clearInterval(timer); timer = setInterval(tick, 100);
    if (app.acquireWake) app.acquireWake();
    render();
  }
  function pause() {
    if (sw && running) swAcc += Date.now() - swStart;
    running = false; clearInterval(timer);
    var app = A(); if (app.releaseWake) app.releaseWake(); if (app.maybeReload) app.maybeReload();
    render();
  }
  function stop() { if (running) pause(); preset = null; done = false; $("tRun").hidden = true; $("tMenu").hidden = false; renderMenu(); }
  function tick() {
    if (!running) return;
    if (sw) { var s = Math.floor((swAcc + Date.now() - swStart) / 1000); if (s !== left) { left = s; render(); } return; }
    var l = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    if (l === left) return;
    left = l;
    if (l > 0 && l <= 3) { var b = A().beep; if (b) b(880, 0.12, 0.3); }
    if (l === 0) {
      if (pi + 1 >= ph.length) { running = false; clearInterval(timer); done = true; cue("end"); var app = A(); if (app.releaseWake) app.releaseWake(); if (app.maybeReload) app.maybeReload(); render(); return; }
      pi++; left = ph[pi].secs; endAt = Date.now() + left * 1000; cue(ph[pi].kind);
    }
    render();
  }
  function render() {
    var run = $("tRun"), p = ph[pi] || { kind: "work", label: "" };
    var t = fmt(left), te = $("tTime");
    te.textContent = t; te.classList.toggle("long", t.length > 2);
    $("tState").textContent = done ? "Done" : sw ? "Hold" : p.label;
    $("tRound").textContent = !sw && p.of > 1 ? (p.round || 1) + " / " + p.of : "";
    $("tHint").textContent = done ? "Tap to go again" : running ? "" : "Tap to " + (left === (ph[pi] ? ph[pi].secs : 0) && pi === 0 && !swAcc ? "start" : "resume");
    run.classList.toggle("rest", !done && (p.kind === "rest"));
    run.classList.toggle("ready", !done && p.kind === "ready" && !sw);
    run.classList.toggle("paused", !running && !done);
  }

  // ---- Menu + editor ----
  var editing = null;
  var FIELDS = {
    cdx: [["Time", "cdx", 15, 15, 3600, true]],
    emom: [["Minutes", "emomMin", 1, 1, 60, false]],
    intv: [["Work", "work", 5, 5, 600, true], ["Rest", "rest", 5, 0, 600, true], ["Rounds", "rounds", 1, 1, 50, false]]
  };
  function fv(v, isTime) { if (!isTime) return String(v); var m = Math.floor(v / 60), s = v % 60; return v < 60 ? v + "s" : m + ":" + (s < 10 ? "0" : "") + s; }
  function renderMenu() {
    var btns = $("tGrid").querySelectorAll(".tPre");
    for (var i = 0; i < btns.length; i++) {
      var id = btns[i].dataset.p;
      btns[i].classList.toggle("last", id === last && id !== editing);
      btns[i].classList.toggle("sel", id === editing);
    }
    var ed = $("tEdit");
    if (!editing) { ed.hidden = true; return; }
    ed.hidden = false;
    var box = $("tFields"); box.innerHTML = "";
    FIELDS[editing].forEach(function (f) {
      var row = document.createElement("div"); row.className = "tField";
      row.innerHTML = '<label></label><button class="tStep" type="button" aria-label="Less">&minus;</button><span class="v"></span><button class="tStep" type="button" aria-label="More">+</button>';
      row.querySelector("label").textContent = f[0];
      row.querySelector(".v").textContent = fv(cfg[f[1]], f[5]);
      var bs = row.querySelectorAll(".tStep");
      bs[0].addEventListener("click", function () { cfg[f[1]] = Math.max(f[3], cfg[f[1]] - f[2]); save("trx:timer:cfg", cfg); renderMenu(); });
      bs[1].addEventListener("click", function () { cfg[f[1]] = Math.min(f[4], cfg[f[1]] + f[2]); save("trx:timer:cfg", cfg); renderMenu(); });
      box.appendChild(row);
    });
  }
  $("tGrid").addEventListener("click", function (e) {
    var b = e.target.closest(".tPre"); if (!b) return;
    var id = b.dataset.p;
    if (FIELDS[id]) { editing = editing === id ? null : id; renderMenu(); return; }
    editing = null; start(id);
  });
  $("tGo").addEventListener("click", function () { var id = editing; editing = null; start(id); });
  $("tTime").addEventListener("click", function () { running ? pause() : play(); });
  $("tStop").addEventListener("click", stop);
  $("tBack").addEventListener("click", function () { close(); });

  function open() { $("timerPage").hidden = false; renderMenu(); }
  function close() { if (running) pause(); $("timerPage").hidden = true; }
  window.TRXTimer = {
    open: open, close: close,
    isOpen: function () { return !$("timerPage").hidden; },
    isRunning: function () { return running; },
    back: function () { if (!$("tRun").hidden) stop(); else close(); }
  };
})();
