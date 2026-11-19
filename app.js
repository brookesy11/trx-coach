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
    renderChips(); render();
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
  function setWake(msg) { var w = $("wake"); w.textContent = msg; w.hidden = !msg; }
  function acquireWake() {
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then(function (l) {
        wakeLock = l; wakeMode = "native";
        setWake("");
        l.addEventListener("release", function () { if (wakeLock === l) wakeLock = null; });
      }).catch(function () { startVideo(); });
    } else startVideo();
  }
  function startVideo() {
    try {
      video.muted = true; video.setAttribute("playsinline", ""); video.setAttribute("muted", "");
      var p = video.play();
      wakeMode = "video";
      if (p && p.then) p.then(function () { setWake(""); })
        .catch(function () { wakeMode = ""; setWake("Screen may sleep. Set Auto-Lock to Never."); });
      else setWake("");
    } catch (e) { setWake("Screen may sleep. Set Auto-Lock to Never."); }
  }
  function releaseWake() {
    if (wakeLock) { try { wakeLock.release(); } catch (e) {} wakeLock = null; }
    try { video.pause(); } catch (e) {}
    wakeMode = "";
    setWake("");
  }

  // ---- Deferred reload for app updates ----
  var pendingReload = false;
  function maybeReload() { if (pendingReload && !running) { persist(); window.location.reload(); } }

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
    maybeReload();
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
    maybeReload();
  }
  function reset() {
    running = false; clearInterval(timer); releaseWake();
    st = fresh(); persist(); render();
    maybeReload();
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

  function nextWork(i) { for (var j = i + 1; j < S.length; j++) if (S[j].kind !== "rest") return S[j]; return null; }
  function infoStep() { var s = S[st.idx]; return s.kind === "rest" ? (nextWork(st.idx) || s) : s; }
  function setText(s) { return s.kind === "warm" ? s.set + " of " + s.sets : "Set " + s.set + " of " + s.sets; }

  function render() {
    var s = S[st.idx];
    $("focus").textContent = plan.focus;
    var nr = nonRest(), doneCount = nr.filter(function (i) { return st.done[i]; }).length;
    var elapsed = 0; for (var i = 0; i < st.idx; i++) elapsed += S[i].secs; elapsed += s.secs - st.left;
    $("barFill").style.width = (st.finished ? 100 : Math.min(100, elapsed / plan.total * 100)) + "%";
    // Under a minute show just the seconds, so the digits can be huge from across the room.
    var ct = st.left < 60 ? String(st.left) : fmt(st.left), ce = $("clock");
    ce.textContent = ct; ce.classList.toggle("long", ct.length > 2);
    if ($("name").textContent !== s.name) { $("name").textContent = s.name; fitName(); }
    var nx = s.kind === "rest" ? nextWork(st.idx) : S[st.idx + 1];
    if (nx && nx.kind === "rest") nx = nextWork(st.idx);
    var curName = s.kind === "rest" ? null : s.name;
    $("next").textContent = !nx ? "Finish" : (nx.kind === "work" && (nx.name === curName || (s.kind === "rest" && nx.set > 1)) ? "Set " + nx.set : nx.name);
    var stage = $("stage");
    stage.classList.toggle("rest", s.kind === "rest");
    stage.classList.toggle("paused", !running);
    $("plusBtn").hidden = s.kind !== "rest";
    var pb = $("playBtn");
    pb.className = "play" + (running ? " on" : " idle");
    pb.setAttribute("aria-label", running ? "Pause" : (st.idx > 0 || st.left < s.secs ? "Resume" : "Start"));
    // chips
    var curEx = s.ex;
    var chips = $("chips").children;
    for (var c = 0; c < chips.length; c++) {
      var ch = chips[c], ex = +ch.dataset.ex, all = true;
      var ticks = ch.querySelectorAll("i"), k = 0;
      S.forEach(function (x, xi) { if (x.kind !== "rest" && x.ex === ex) { ticks[k].className = st.done[xi] ? "on" : ""; if (!st.done[xi]) all = false; k++; } });
      ch.className = "chip" + (ex === curEx ? " cur" : "") + (all ? " done" : "");
    }
    if (!$("howto").hidden) $("hClock").textContent = (s.kind === "rest" ? "Rest " : "") + fmt(st.left);
    // finish
    var fin = $("finish");
    if (st.finished) {
      fin.hidden = false;
      $("finishFocus").textContent = plan.focus + " \u00b7 " + fmtDate(plan.key);
      $("finishStat").textContent = doneCount + " of " + nr.length + " sets \u00b7 " + Math.round(plan.total / 60) + " min";
      var sk = streak();
      $("finishStreak").textContent = sk.streak > 1 ? sk.streak + "-day streak" : (sk.total ? sk.total + (sk.total === 1 ? " session" : " sessions") : "");
      var tm = new Date(T.parseKey(plan.key).getTime()); tm.setDate(tm.getDate() + 1);
      $("finishTomorrow").textContent = "Tomorrow: " + T.planFor(T.dateKey(tm)).focus;
    } else fin.hidden = true;
  }

  function jumpToEx(ex) {
    var first = -1, open = -1;
    S.forEach(function (x, i) { if (x.kind !== "rest" && x.ex === ex) { if (first < 0) first = i; if (open < 0 && !st.done[i]) open = i; } });
    goTo(open >= 0 ? open : first, false);
  }

  function renderChips() {
    var nav = $("chips"); nav.innerHTML = "";
    var groups = [{ ex: -1, n: "W", label: "Warm-up" }].concat(plan.moves.map(function (m, i) { return { ex: i, n: String(i + 1), label: m }; }));
    groups.forEach(function (g) {
      var count = S.filter(function (x) { return x.kind !== "rest" && x.ex === g.ex; }).length;
      var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.dataset.ex = g.ex;
      b.setAttribute("aria-label", g.label);
      b.innerHTML = '<span class="n"></span><span class="ticks">' + new Array(count + 1).join("<i></i>") + "</span>";
      b.querySelector(".n").textContent = g.n;
      b.addEventListener("click", function () { jumpToEx(g.ex); });
      nav.appendChild(b);
    });
  }

  // ---- How-to popup (timer keeps running; the sheet shows the live countdown) ----
  function openHowto() {
    var s = infoStep(), h = (window.HOWTO || {})[s.name];
    $("hName").textContent = s.name;
    $("hSetup").textContent = h ? h.setup : s.cue;
    var ol = $("hSteps"); ol.innerHTML = "";
    (h ? h.steps : []).forEach(function (t) { var li = document.createElement("li"); li.textContent = t; ol.appendChild(li); });
    $("hAvoid").textContent = h ? h.avoid : "";
    $("hEasier").textContent = h ? h.easier : "";
    $("hHarder").textContent = h ? h.harder : "";
    $("howto").hidden = false;
    $("howto").querySelector(".sheet").scrollTop = 0;
    render();
  }
  function closeHowto() { $("howto").hidden = true; }
  $("infoBtn").addEventListener("click", openHowto);
  $("hClose").addEventListener("click", closeHowto);
  $("howto").addEventListener("click", function (e) { if (e.target === $("howto")) closeHowto(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeHowto(); });

  // ---- Name auto-fit: as large as possible, max 2 lines ----
  function fitName() {
    var el = $("name");
    var max = Math.min(window.innerWidth * 0.15, window.innerHeight * 0.08, 84), size = Math.round(max);
    el.style.fontSize = size + "px";
    while (size > 22 && (el.scrollHeight > size * 1.05 * 2 + 4 || el.scrollWidth > el.clientWidth + 1)) {
      size -= 2; el.style.fontSize = size + "px";
    }
  }
  window.addEventListener("resize", fitName);

  // ---- Controls ----
  function toggle() { running ? pause() : play(); }
  function hideHint() { if (!$("hint").hidden) { $("hint").hidden = true; } save("trx:hinted", true); }
  if (!load("trx:hinted", false)) $("hint").hidden = false;

  var inner = $("stageInner"), animating = false;
  function slide(dir, change) { // dir -1 = content leaves to the left (next), +1 = to the right (back)
    var w = Math.min(window.innerWidth, 600) * 0.35;
    inner.classList.remove("dragging");
    inner.style.transform = "translateX(" + (dir * w) + "px)"; inner.style.opacity = "0";
    animating = true;
    setTimeout(function () {
      change();
      inner.classList.add("dragging");
      inner.style.transform = "translateX(" + (-dir * w) + "px)";
      void inner.offsetWidth;
      inner.classList.remove("dragging");
      inner.style.transform = ""; inner.style.opacity = "";
      animating = false;
    }, 140);
  }
  function snapBack() { inner.classList.remove("dragging"); inner.style.transform = ""; inner.style.opacity = ""; }
  function next() {
    if (st.finished) return;
    unlockAudio();
    slide(-1, function () { goTo(st.idx + 1, true); });
  }
  function back() {
    if (st.finished) { st.finished = false; persist(); render(); return; }
    if (st.idx === 0) { snapBack(); return; }
    slide(1, function () { goTo(st.idx - 1, false); });
  }

  // Swipe: >= 50px horizontal and clearly more horizontal than vertical.
  var tx = 0, ty = 0, tracking = false, horiz = false, lastSwipe = 0;
  function onStart(e) {
    if (!$("howto").hidden || e.touches.length > 1 || animating) { tracking = false; return; }
    tracking = true; horiz = false; tx = e.touches[0].clientX; ty = e.touches[0].clientY;
  }
  function onMove(e) {
    if (!tracking) return;
    var dx = e.touches[0].clientX - tx, dy = e.touches[0].clientY - ty;
    if (!horiz && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) horiz = true;
    if (horiz) {
      e.preventDefault(); // keep the browser from treating it as navigation/scroll
      if (!st.finished) { inner.classList.add("dragging"); inner.style.transform = "translateX(" + (dx * 0.6) + "px)"; inner.style.opacity = String(Math.max(0.3, 1 - Math.abs(dx) / 400)); }
    }
  }
  function onEnd(e) {
    if (!tracking) return; tracking = false;
    var t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
    if (horiz && Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      lastSwipe = Date.now(); hideHint();
      if (dx < 0) next(); else back();
    } else snapBack();
  }
  [document.getElementById("app"), $("finish")].forEach(function (el) {
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", function () { tracking = false; snapBack(); }, { passive: true });
  });

  $("playBtn").addEventListener("click", toggle);
  $("clock").addEventListener("click", function () { if (Date.now() - lastSwipe > 400) toggle(); });
  $("plusBtn").addEventListener("click", function () { st.left += 15; if (running) endAt += 15000; persist(); render(); });
  $("againBtn").addEventListener("click", reset);
  document.addEventListener("keydown", function (e) {
    if (!$("howto").hidden) return;
    if (e.key === "ArrowRight") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
    else if (e.key === " ") { e.preventDefault(); toggle(); }
  });

  // ---- Lifecycle ----
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      if (running && !wakeLock && wakeMode !== "video") acquireWake();
      if (running && wakeMode === "video") { try { video.play(); } catch (e) {} }
      if (!running && T.dateKey(new Date()) !== todayKey) initDay();
      else tick();
    } else {
      persist();
      maybeReload();
    }
  });
  window.addEventListener("pagehide", persist);

  initDay();

  if ("serviceWorker" in navigator) {
    var hadController = !!navigator.serviceWorker.controller, reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      // Never interrupt a running set: reload now if idle, otherwise as soon as the timer stops.
      if (hadController && !reloaded) { reloaded = true; pendingReload = true; maybeReload(); }
    });
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js", { scope: "./", updateViaCache: "none" }).then(function (reg) {
        reg.update();
        document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") reg.update(); });
      }).catch(function () {});
    });
  }
})();
