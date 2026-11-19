/* TRX Coach player */
(function () {
  "use strict";
  var T = window.TRX;
  var $ = function (id) { return document.getElementById(id); };
  var LS = window.localStorage;

  function load(k, dflt) { try { var v = LS.getItem(k); return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; } }
  function save(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // ---- Plan for today ----
  var todayKey = T.dateKey(new Date());
  var plan, S, st; // plan, steps, state

  function fresh() { return { key: plan.key, sig: plan.sig, idx: 0, left: S[0].secs, done: S.map(function () { return false; }), finished: false, startedAt: null }; }

  function initDay() {
    todayKey = T.dateKey(new Date());
    plan = T.planFor(todayKey);
    S = plan.steps;
    var saved = load("trx:day", null);
    if (saved && saved.key === plan.key && saved.sig === plan.sig && saved.done && saved.done.length === S.length) st = saved;
    else st = fresh();
    running = false;
    renderList(); render();
  }

  // ---- Audio (Web Audio, unlocked on first tap for iOS) ----
  var ctx = null;
  function unlockAudio() {
    try {
      if (!ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); }
      if (ctx.state === "suspended") ctx.resume();
      var b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
    } catch (e) {}
  }
  function beep(freq, dur, vol) {
    if (!ctx) return;
    try {
      var o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime;
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.3, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.15));
      o.connect(g); g.connect(ctx.destination); o.start(t0); o.stop(t0 + (dur || 0.15) + 0.02);
    } catch (e) {}
  }
  function transitionBeep(toKind) {
    if (toKind === "rest") { beep(660, 0.35, 0.3); }
    else { beep(1046, 0.18, 0.35); setTimeout(function () { beep(1318, 0.3, 0.35); }, 180); }
  }
  document.addEventListener("pointerdown", unlockAudio, { passive: true });
  document.addEventListener("touchend", unlockAudio, { passive: true });

  // ---- Keep screen awake ----
  var wakeLock = null, video = $("nosleep"), wakeMode = "";
  function setWake(msg) { $("wake").textContent = msg; }
  function acquireWake() {
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then(function (l) {
        wakeLock = l; wakeMode = "native";
        setWake("Screen will stay on while the timer runs.");
        l.addEventListener("release", function () { if (wakeLock === l) wakeLock = null; });
      }).catch(function () { startVideo(); });
    } else startVideo();
  }
  function startVideo() {
    try {
      video.muted = true; video.setAttribute("playsinline", ""); video.setAttribute("muted", "");
      var p = video.play();
      wakeMode = "video";
      if (p && p.then) p.then(function () { setWake("Screen will stay on while the timer runs."); })
        .catch(function () { wakeMode = ""; setWake("Can't keep the screen awake here. Set Auto-Lock to Never during your workout."); });
      else setWake("Screen will stay on while the timer runs.");
    } catch (e) { setWake("Can't keep the screen awake here. Set Auto-Lock to Never during your workout."); }
  }
  function releaseWake() {
    if (wakeLock) { try { wakeLock.release(); } catch (e) {} wakeLock = null; }
    try { video.pause(); } catch (e) {}
    wakeMode = "";
    setWake("");
  }

  // ---- Timer ----
  var running = false, timer = null, endAt = 0;
  function persist() { save("trx:day", st); }

  function startTimer() {
    endAt = Date.now() + st.left * 1000;
    clearInterval(timer);
    timer = setInterval(tick, 200);
  }
  function tick() {
    if (!running) return;
    var left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    if (left !== st.left) {
      st.left = left;
      if (left > 0 && left <= 3) beep(880, 0.12, 0.3);
      if (left === 0) { goTo(st.idx + 1, true); return; }
      persist(); render();
    }
  }
  function play() {
    unlockAudio();
    if (st.finished) return;
    running = true;
    if (!st.startedAt) st.startedAt = Date.now();
    startTimer(); acquireWake(); persist(); render();
  }
  function pause() {
    running = false; clearInterval(timer); releaseWake(); persist(); render();
  }
  function goTo(i, markCurrent) {
    if (markCurrent) st.done[st.idx] = true;
    if (i >= S.length) { finish(); return; }
    st.idx = Math.max(0, i);
    st.left = S[st.idx].secs;
    if (running) { startTimer(); transitionBeep(S[st.idx].kind); }
    persist(); render();
  }
  function finish() {
    running = false; clearInterval(timer); releaseWake();
    if (!st.finished) {
      st.finished = true;
      beep(784, 0.2, 0.35); setTimeout(function () { beep(1046, 0.2, 0.35); }, 200); setTimeout(function () { beep(1318, 0.45, 0.35); }, 400);
      var nr = nonRest(), dn = nr.filter(function (i) { return st.done[i]; }).length;
      var hist = load("trx:history", []);
      // Count toward the streak only if at least half the moves were done.
      if (dn * 2 >= nr.length && hist.indexOf(plan.key) === -1) { hist.push(plan.key); save("trx:history", hist); }
    }
    persist(); render();
  }
  function reset() {
    running = false; clearInterval(timer); releaseWake();
    st = fresh(); persist(); render();
  }

  // ---- Streak ----
  function streak() {
    var hist = load("trx:history", []), set = {};
    hist.forEach(function (k) { set[T.dayNumber(k)] = true; });
    var n = T.dayNumber(todayKey), c = 0;
    if (!set[n]) n -= 1; // streak still alive if yesterday counted
    while (set[n]) { c++; n--; }
    return { streak: c, total: hist.length };
  }

  // ---- Render ----
  function fmt(s) { var m = Math.floor(s / 60), r = s % 60; return m + ":" + (r < 10 ? "0" : "") + r; }
  function fmtDate(k) { return T.parseKey(k).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
  function nonRest() { var a = []; S.forEach(function (s, i) { if (s.kind !== "rest") a.push(i); }); return a; }

  function render() {
    var s = S[st.idx];
    $("focus").textContent = plan.focus + " \u00b7 Day " + plan.dayOfCycle + " of 4";
    $("date").textContent = fmtDate(plan.key);
    $("section").textContent = s.label;
    var nr = nonRest(), doneCount = nr.filter(function (i) { return st.done[i]; }).length;
    $("count").textContent = doneCount + "/" + nr.length + " done";
    var elapsed = 0; for (var i = 0; i < st.idx; i++) elapsed += S[i].secs; elapsed += s.secs - st.left;
    $("barFill").style.width = (st.finished ? 100 : Math.min(100, elapsed / plan.total * 100)) + "%";
    $("clock").textContent = fmt(st.left);
    $("name").textContent = s.name;
    $("cue").textContent = s.cue;
    var nx = S[st.idx + 1];
    $("next").textContent = nx ? (nx.kind === "rest" ? "Rest " + nx.secs + "s" : nx.name) : "Finish";
    document.querySelector(".stage").classList.toggle("rest", s.kind === "rest");
    var sb = $("startBtn");
    sb.textContent = running ? "Pause" : (st.idx > 0 || st.left < s.secs ? "Resume" : "Start");
    sb.className = "btn " + (running ? "outline" : "solid");
    // list
    var items = $("list").children;
    for (var j = 0; j < items.length; j++) {
      var li = items[j], idx = +li.dataset.idx;
      li.className = (st.done[idx] ? "done " : "") + (idx === st.idx ? "cur" : "");
      li.querySelector(".chk").textContent = st.done[idx] ? "\u2713" : "";
    }
    // finish
    var fin = $("finish");
    if (st.finished) {
      fin.hidden = false;
      $("finishFocus").textContent = plan.focus + " \u00b7 " + fmtDate(plan.key);
      $("finishStat").textContent = doneCount + " of " + nr.length + " moves \u00b7 " + Math.round(plan.total / 60) + " min";
      var sk = streak();
      $("finishStreak").textContent = sk.streak > 1 ? sk.streak + "-day streak \u00b7 " + sk.total + " sessions total" : (sk.total ? sk.total + (sk.total === 1 ? " session" : " sessions") + " completed" : "Finish at least half the moves to start a streak");
      var tm = new Date(T.parseKey(plan.key).getTime()); tm.setDate(tm.getDate() + 1);
      $("finishTomorrow").textContent = "Tomorrow: " + T.planFor(T.dateKey(tm)).focus;
    } else fin.hidden = true;
  }

  function renderList() {
    var ol = $("list"); ol.innerHTML = "";
    S.forEach(function (s, i) {
      if (s.kind === "rest") return;
      var li = document.createElement("li"); li.dataset.idx = i;
      var b = document.createElement("button"); b.type = "button";
      b.innerHTML = '<span class="chk" aria-hidden="true"></span><span class="nm"></span><span class="tag"></span>';
      b.querySelector(".nm").textContent = s.name;
      b.querySelector(".tag").textContent = (s.kind === "work" ? s.label.replace(/ of \d+/, "") : s.label) + " \u00b7 " + s.secs + "s";
      b.addEventListener("click", function () { goTo(i, false); window.scrollTo({ top: 0, behavior: "smooth" }); });
      li.appendChild(b); ol.appendChild(li);
    });
  }

  // ---- Buttons ----
  $("startBtn").addEventListener("click", function () { running ? pause() : play(); });
  $("completeBtn").addEventListener("click", function () { unlockAudio(); goTo(st.idx + 1, true); });
  $("backBtn").addEventListener("click", function () { goTo(st.idx - 1, false); });
  $("skipBtn").addEventListener("click", function () { goTo(st.idx + 1, false); });
  $("plusBtn").addEventListener("click", function () { st.left += 15; if (running) endAt += 15000; persist(); render(); });
  $("resetBtn").addEventListener("click", function () { if (confirm("Reset today's workout?")) reset(); });
  $("againBtn").addEventListener("click", reset);

  // ---- Lifecycle ----
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      if (running && !wakeLock && wakeMode !== "video") acquireWake();
      if (running && wakeMode === "video") { try { video.play(); } catch (e) {} }
      if (!running && T.dateKey(new Date()) !== todayKey) initDay();
      else tick();
    } else {
      persist();
    }
  });
  window.addEventListener("pagehide", persist);

  initDay();

  if ("serviceWorker" in navigator) {
    var hadController = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (hadController && !reloaded) { reloaded = true; window.location.reload(); }
    });
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js", { scope: "./", updateViaCache: "none" }).then(function (reg) {
        reg.update();
        document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") reg.update(); });
      }).catch(function () {});
    });
  }
})();
