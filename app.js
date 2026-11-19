/* TRX Coach player */
(function () {
  "use strict";
  var T = window.TRX;
  var $ = function (id) { return document.getElementById(id); };
  var LS = window.localStorage;

  function load(k, dflt) { try { var v = LS.getItem(k); return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; } }
  function save(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // ---- User swaps, per date: trx:ov:YYYY-MM-DD = { slot: name } ----
  function loadOv(k) { return load("trx:ov:" + k, null); }
  function saveOv(k, ov) { save("trx:ov:" + k, ov); }

  // ---- One-time fresh start: tracking begins 2026-11-19 ----
  // Runs on the first load on/after that date (so tonight's session is untouched): drops every on-device
  // record dated before it (log, history/streak, done/closed/rating/progress, old swaps, unsent pings).
  // Keeps the ntfy topic, timer settings and swaps for 2026-11-19 onward.
  function freshStart() {
    var CUT = "2026-11-19", FLAG = "trx:reset20261119";
    if (T.dateKey(new Date()) < CUT || LS.getItem(FLAG)) return;
    try {
      var lg = load("trx:log", {}), keep = {};
      Object.keys(lg || {}).forEach(function (k) { if (k >= CUT) keep[k] = lg[k]; });
      save("trx:log", keep);
      save("trx:history", load("trx:history", []).filter(function (k) { return k >= CUT; }));
      var day = load("trx:day", null); if (day && (!day.key || day.key < CUT)) LS.removeItem("trx:day");
      save("trx:pingq", load("trx:pingq", []).filter(function (b) { try { return JSON.parse(b).d >= CUT; } catch (e) { return false; } }));
      var dated = /^trx:(pinged|rate|closed|ov):(\d{4}-\d{2}-\d{2})$/, rm = [];
      for (var i = 0; i < LS.length; i++) { var k = LS.key(i), m = dated.exec(k || ""); if (m && m[2] < CUT) rm.push(k); }
      rm.forEach(function (k) { LS.removeItem(k); });
      LS.setItem(FLAG, String(Date.now()));
    } catch (e) {}
  }
  freshStart();

  // ---- Completion ping (ntfy.sh): once per date, queued until a POST succeeds ----
  // The topic is never in the code: it lives only in this device's localStorage (trx:ntfyTopic), set when the phone was paired.
  var TOPIC_RE = /^[A-Za-z0-9_-]{16,64}$/;
  function pingTopic() { var t = load("trx:ntfyTopic", ""); return TOPIC_RE.test(t) ? t : ""; }
  function queuePing(dateKey, body) {
    if (load("trx:pinged:" + dateKey, false)) return;
    save("trx:pinged:" + dateKey, true);
    var q = load("trx:pingq", []); q.push(body); save("trx:pingq", q);
    flushPings();
  }
  var flushing = false;
  function flushPings() {
    var topic = pingTopic();
    if (flushing || !window.fetch || !topic) return; // not paired yet: keep it queued
    var q = load("trx:pingq", []);
    if (!q.length) return;
    flushing = true;
    var body = q[0];
    fetch("https://ntfy.sh/" + topic, { method: "POST", body: body, keepalive: true }).then(function (r) {
      flushing = false;
      if (!r.ok) return;
      var cur = load("trx:pingq", []); if (cur[0] === body) cur.shift(); save("trx:pingq", cur);
      if (cur.length) flushPings();
    }).catch(function () { flushing = false; });
  }
  // Difficulty rating (1 easy, 2 solid, 3 brutal): a small follow-up ping, latest wins.
  function queueRating(dateKey, r) {
    save("trx:rate:" + dateKey, r);
    var pre = load("trx:pingPrefix", ""), tag = pre ? pre + "-rate" : "rate"; // tests: "test-rate", ignored by the bot
    var q = load("trx:pingq", []);
    // Drop any older unsent rating for this date (except one already in flight).
    q = q.filter(function (b, i) { if (flushing && i === 0) return true; try { var j = JSON.parse(b); return !(/rate$/.test(j.t) && j.d === dateKey); } catch (e) { return true; } });
    q.push(JSON.stringify({ t: tag, d: dateKey, r: r })); save("trx:pingq", q);
    var lg = load("trx:log", {}); if (lg[dateKey]) { lg[dateKey].r = r; save("trx:log", lg); }
    flushPings();
  }
  window.addEventListener("online", flushPings);
  setTimeout(flushPings, 1500);

  // ---- Plan for today ----
  var todayKey = T.dateKey(new Date());
  var plan, S, st; // plan, steps, state

  function fresh() { return { key: plan.key, sig: plan.sig, idx: 0, left: S[0].secs, done: S.map(function () { return false; }), finished: false, startedAt: null }; }

  function initDay() {
    freshStart(); // also covers an app left open across midnight into 2026-11-19
    todayKey = T.dateKey(new Date());
    plan = T.planFor(todayKey, loadOv(todayKey));
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
  function maybeReload() {
    var tRun = window.TRXTimer && window.TRXTimer.isRunning();
    if (pendingReload && !running && !tRun) { persist(); window.location.reload(); }
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
      st.finishedAt = Date.now();
      try {
        var tag = load("trx:pingPrefix", "") || "done"; // tests set "test" so the bot ignores them
        queuePing(plan.key, JSON.stringify({ t: tag, d: plan.key, type: plan.focus.toUpperCase(),
          sec: st.startedAt ? Math.round((st.finishedAt - st.startedAt) / 1000) : 0, ex: plan.moves }));
      } catch (e) {}
      beep(784, 0.2, 0.35); setTimeout(function () { beep(1046, 0.2, 0.35); }, 200); setTimeout(function () { beep(1318, 0.45, 0.35); }, 400);
      var nr = nonRest(), dn = nr.filter(function (i) { return st.done[i]; }).length;
      var hist = load("trx:history", []);
      // Count toward the streak only if at least half the moves were done.
      if (dn * 2 >= nr.length && hist.indexOf(plan.key) === -1) { hist.push(plan.key); save("trx:history", hist); }
      // On-device completion log (source for Home): { date: { type, sec, r } }.
      if (dn * 2 >= nr.length) {
        var lg = load("trx:log", {}), rt = load("trx:rate:" + plan.key, 0);
        lg[plan.key] = { type: plan.focus, sec: st.startedAt ? Math.round((st.finishedAt - st.startedAt) / 1000) : 0 };
        if (rt) lg[plan.key].r = rt;
        save("trx:log", lg);
      }
    }
    persist(); render();
    maybeReload();
  }
  function reset() {
    running = false; clearInterval(timer); releaseWake();
    st = fresh(); persist(); render();
    maybeReload();
  }

  // ---- Completion log: backfill from the older date-only history once ----
  (function migrateLog() {
    var lg = load("trx:log", null); if (lg) return;
    lg = {}; load("trx:history", []).forEach(function (k) { try { lg[k] = { type: T.planFor(k, null).focus, sec: 0 }; } catch (e) {} });
    save("trx:log", lg);
  })();

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
  function fmtElapsed(ms) {
    var t = Math.max(0, Math.round(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return h ? h + ":" + p(m) + ":" + p(s) : m + ":" + p(s);
  }
  function tomorrowKey() { var d = T.parseKey(todayKey); d.setDate(d.getDate() + 1); return T.dateKey(d); }
  // Swaps stay pending until Save.
  var pendingOv = null;
  function ovEqual(a, b) { return JSON.stringify(a || {}) === JSON.stringify(b || {}); }
  function renderSave(justSaved) {
    var b = $("saveBtn"), dirty = pendingOv && !ovEqual(pendingOv, loadOv(tomorrowKey()));
    if (justSaved) { b.hidden = false; b.textContent = "Saved \u2713"; b.classList.add("saved"); setTimeout(function () { if (!pendingOv || ovEqual(pendingOv, loadOv(tomorrowKey()))) b.hidden = true; }, 1600); return; }
    b.textContent = "Save"; b.classList.remove("saved"); b.hidden = !dirty;
  }
  function renderTomorrow() {
    var k = tomorrowKey();
    if (!pendingOv) pendingOv = JSON.parse(JSON.stringify(loadOv(k) || {}));
    var tp = T.planFor(k, pendingOv);
    $("tmrHead").textContent = "Tomorrow \u00b7 " + tp.focus;
    var ol = $("tmrList"); ol.innerHTML = "";
    tp.moves.forEach(function (name, slot) {
      var li = document.createElement("li");
      var nb = document.createElement("button"); nb.type = "button"; nb.className = "tmrName"; nb.textContent = name;
      nb.addEventListener("click", function () { if (Date.now() - lastSwipe > 400) openHowto(name); });
      var sb = document.createElement("button"); sb.type = "button"; sb.className = "tmrSwap"; sb.textContent = "\u21bb";
      sb.setAttribute("aria-label", "Swap " + name);
      sb.addEventListener("click", function () { swapTomorrow(slot); });
      li.appendChild(nb); li.appendChild(sb); ol.appendChild(li);
    });
    renderSave();
  }
  function swapTomorrow(slot) {
    var k = tomorrowKey(); if (!pendingOv) pendingOv = JSON.parse(JSON.stringify(loadOv(k) || {}));
    var tp = T.planFor(k, pendingOv);
    var opts = T.swapOptions(k, slot, tp.moves);
    if (!opts.length) return;
    pendingOv[slot] = opts[Math.floor(Math.random() * opts.length)];
    renderTomorrow();
    var b = $("tmrList").children[slot].querySelector(".tmrSwap"); b.classList.add("spin");
  }
  function saveTomorrow() { saveOv(tomorrowKey(), JSON.parse(JSON.stringify(pendingOv || {}))); renderSave(true); }
  function fmtDate(k) { return T.parseKey(k).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
  function nonRest() { var a = []; S.forEach(function (s, i) { if (s.kind !== "rest") a.push(i); }); return a; }

  function nextWork(i) { for (var j = i + 1; j < S.length; j++) if (S[j].kind !== "rest") return S[j]; return null; }
  function infoStep() { var s = S[st.idx]; return s.kind === "rest" ? (nextWork(st.idx) || s) : s; }
  function setText(s) { return s.kind === "warm" ? s.set + " of " + s.sets : "Set " + s.set + " of " + s.sets; }

  // ---- Home: week / month / year counts, month grid, year strip ----
  function renderHome() {
    var lg = load("trx:log", {}), today = T.parseKey(todayKey), y = today.getFullYear(), mo = today.getMonth();
    var dow = (today.getDay() + 6) % 7, wk0 = new Date(y, mo, today.getDate() - dow), wkStart = T.dateKey(wk0);
    var w = 0, m = 0, yr = 0, perMonth = [0,0,0,0,0,0,0,0,0,0,0,0];
    Object.keys(lg).forEach(function (k) {
      if (k > todayKey) return;
      var d = T.parseKey(k); if (d.getFullYear() !== y) return;
      yr++; perMonth[d.getMonth()]++;
      if (d.getMonth() === mo) m++;
      if (k >= wkStart) w++;
    });
    $("stWeek").textContent = w; $("stMonth").textContent = m; $("stYear").textContent = yr;
    var sk = streak(); $("hStreak").textContent = sk.streak > 1 ? sk.streak + "-day streak" : "";
    $("calHead").textContent = today.toLocaleDateString(undefined, { month: "long" });
    var g = $("calGrid"), html = "", first = (new Date(y, mo, 1).getDay() + 6) % 7, n = new Date(y, mo + 1, 0).getDate();
    for (var i = 0; i < first; i++) html += '<span class="pad"></span>';
    for (var dd = 1; dd <= n; dd++) {
      var k = T.dateKey(new Date(y, mo, dd)), cls = lg[k] ? "on" : k > todayKey ? "fut" : "";
      if (k === todayKey) cls += " today";
      html += '<span class="' + cls + '" title="' + k + '"></span>';
    }
    g.innerHTML = html;
    var yh = "";
    for (var mi = 0; mi < 12; mi++) { var days = new Date(y, mi + 1, 0).getDate(); yh += '<i><b style="width:' + Math.min(100, perMonth[mi] / days * 100).toFixed(1) + '%"></b></i>'; }
    $("yearRow").innerHTML = yh;
    var tp = T.planFor(tomorrowKey(), loadOv(tomorrowKey()));
    $("hNext").textContent = "Tomorrow \u00b7 " + tp.focus;
  }

  function render() {
    var s = S[st.idx];
    $("focus").textContent = plan.focus;
    var nr = nonRest(), doneCount = nr.filter(function (i) { return st.done[i]; }).length;
    var elapsed = 0; for (var i = 0; i < st.idx; i++) elapsed += S[i].secs; elapsed += s.secs - st.left;
    $("barFill").style.width = (st.finished ? 100 : Math.min(100, elapsed / plan.total * 100)) + "%";
    // Under a minute show just the seconds, so the digits can be huge from across the room.
    var ct = st.left < 60 ? String(st.left) : fmt(st.left), ce = $("clock");
    ce.textContent = ct; ce.classList.toggle("long", ct.length > 2);
    var dname = s.name.replace(/-/g, "\u2011"); // non-breaking hyphen: never split "push-up"
    if ($("name").textContent !== dname) { $("name").textContent = dname; fitName(); }
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
      var tot = 0, dn = 0;
      S.forEach(function (x, xi) { if (x.kind !== "rest" && x.ex === ex) { tot++; if (st.done[xi]) dn++; else all = false; } });
      ch.querySelector(".pfill").style.width = (tot ? dn / tot * 100 : 0) + "%";
      ch.className = "chip" + (ex === curEx ? " cur" : "") + (all ? " done" : "");
    }
    if (!$("howto").hidden) $("hClock").textContent = (s.kind === "rest" ? "Rest " : "") + fmt(st.left);
    // finish
    var fin = $("finish"), closed = st.finished && load("trx:closed:" + plan.key, false);
    $("home").hidden = !closed;
    if (closed) { fin.hidden = true; renderHome(); }
    else if (st.finished) {
      var wasHidden = fin.hidden;
      fin.hidden = false;
      $("finishFocus").textContent = plan.focus + " \u00b7 Done";
      var ms = st.startedAt && st.finishedAt ? st.finishedAt - st.startedAt : 0;
      $("finishTime").textContent = fmtElapsed(ms);
      var sk = streak();
      $("finishStreak").textContent = sk.streak > 1 ? sk.streak + "-day streak" : "";
      renderRate();
      if (wasHidden) renderTomorrow();
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
      var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.dataset.ex = g.ex;
      b.setAttribute("aria-label", g.label);
      b.innerHTML = '<span class="pfill"></span><span class="n"></span>';
      b.querySelector(".n").textContent = g.n;
      b.addEventListener("click", function () { jumpToEx(g.ex); });
      nav.appendChild(b);
    });
  }

  var lastSwipe = 0;
  // ---- How-to popup (timer keeps running; the sheet shows the live countdown) ----
  function openHowto(forName) {
    var s = typeof forName === "string" ? { name: forName, cue: "" } : infoStep(), h = (window.HOWTO || {})[s.name];
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
  function tapHowto() { if (Date.now() - lastSwipe > 400) openHowto(); }
  $("name").addEventListener("click", tapHowto);
  $("nextLine").addEventListener("click", tapHowto);
  $("name").addEventListener("keydown", function (e) { if (e.key === "Enter") openHowto(); });
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
    if (!st.startedAt) st.startedAt = Date.now();
    unlockAudio();
    slide(-1, function () { goTo(st.idx + 1, true); });
  }
  function back() {
    if (st.finished) { st.finished = false; persist(); render(); return; }
    if (st.idx === 0) { snapBack(); return; }
    slide(1, function () { goTo(st.idx - 1, false); });
  }

  // Swipe: >= 50px horizontal and clearly more horizontal than vertical.
  var tx = 0, ty = 0, tracking = false, horiz = false;
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
      lastSwipe = Date.now();
      if (st.finished || (window.TRXTimer && window.TRXTimer.isOpen())) return; // swipes only step through the workout
      if (dx < 0) next(); else back();
    } else snapBack();
  }
  [document.getElementById("app")].forEach(function (el) {
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", function () { tracking = false; snapBack(); }, { passive: true });
  });

  $("playBtn").addEventListener("click", toggle);
  $("clock").addEventListener("click", function () { if (Date.now() - lastSwipe > 400) toggle(); });
  $("plusBtn").addEventListener("click", function () { st.left += 15; if (running) endAt += 15000; persist(); render(); });
  function renderRate() {
    var r = load("trx:rate:" + plan.key, 0), bs = $("rate").querySelectorAll(".rateBtn");
    $("rate").classList.toggle("has", !!r);
    for (var i = 0; i < bs.length; i++) { var on = +bs[i].dataset.r === r; bs[i].classList.toggle("on", on); bs[i].setAttribute("aria-pressed", on ? "true" : "false"); }
  }
  $("rate").addEventListener("click", function (e) {
    var b = e.target.closest(".rateBtn"); if (!b) return;
    var r = +b.dataset.r; if (r === load("trx:rate:" + plan.key, 0)) return;
    queueRating(plan.key, r); renderRate();
  });
  $("saveBtn").addEventListener("click", saveTomorrow);
  // Finished: auto-save pending swaps, close the day, go Home until tomorrow.
  $("finishedBtn").addEventListener("click", function () {
    if (pendingOv && !ovEqual(pendingOv, loadOv(tomorrowKey()))) saveOv(tomorrowKey(), JSON.parse(JSON.stringify(pendingOv)));
    save("trx:closed:" + plan.key, true); render();
  });
  $("redoBtn").addEventListener("click", function () {
    try { localStorage.removeItem("trx:closed:" + plan.key); } catch (e) {}
    pendingOv = null; reset();
  });
  $("home").querySelector(".hTimers").addEventListener("click", function (e) {
    var b = e.target.closest(".hTimer"); if (b && window.TRXTimer) window.TRXTimer.open(b.dataset.t);
  });
  // A new local day while Home (or the finish screen) is up: show the new workout.
  setInterval(function () { if (!running && T.dateKey(new Date()) !== todayKey && !(window.TRXTimer && window.TRXTimer.isRunning())) { pendingOv = null; initDay(); } }, 30000);
  document.addEventListener("keydown", function (e) {
    if (!$("howto").hidden) return;
    var TT = window.TRXTimer;
    if (TT && TT.isOpen()) { if (e.key === "Escape") { e.preventDefault(); TT.close(); } else if (e.key === " ") { e.preventDefault(); TT.toggle(); } return; }
    if (st.finished) return;
    if (e.key === "ArrowRight") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
    else if (e.key === " ") { e.preventDefault(); toggle(); }
  });

  // ---- Lifecycle ----
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      var awake = running || (window.TRXTimer && window.TRXTimer.isRunning());
      if (awake && !wakeLock && wakeMode !== "video") acquireWake();
      if (awake && wakeMode === "video") { try { video.play(); } catch (e) {} }
      if (!running && T.dateKey(new Date()) !== todayKey) initDay();
      else tick();
    } else {
      persist();
      maybeReload();
    }
  });
  window.addEventListener("pagehide", persist);

  window.TRXAPP = { beep: beep, unlockAudio: unlockAudio, acquireWake: acquireWake, releaseWake: releaseWake, maybeReload: maybeReload };
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
