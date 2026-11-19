/* TRX Coach - deterministic daily workout generator. No network, no daily updates.
   4-day cycle: Push, Pull, Legs, Full body, repeating on a continuous local-day count.
   Anchor: Wed 2026-11-18 = Push. Each session: 1-min warm-up + 5 moves x 3 straight sets
   (4 focus moves + 1 abs move), 45s work / 15s rest. */
(function (root) {
  "use strict";

  var ANCHOR = "2026-11-18"; // Push day
  var WORK = 45, REST = 15, SETS = 3;

  // Each focus = 4 slots. Each slot lists options as [weight, name, cue].
  // Higher weight = more common / better-regarded in the research, so it appears more often.
  var DAYS = [
    { key: "push", title: "Push", warm: ["Arm circles", "Overhead reach"], slots: [
      [[3, "TRX chest press", "Face away, body in a plank, lower chest to hands, press out."],
       [1, "Staggered chest press", "One foot forward, press out, switch feet each set."]],
      [[2, "TRX push-up", "Feet in cradles, body rigid, lower chest to floor. Knees down is fine."],
       [2, "Atomic push-up", "Feet in cradles. One push-up, then pull knees to chest."]],
      [[2, "Chest fly", "Face away, soft elbows, open wide, hug the straps back together."],
       [1, "Pike push-up", "Feet in cradles, hips high, lower head between hands, press up."]],
      [[3, "Triceps extension", "Face away, elbows by ears, bend to forehead, press straight."],
       [1, "Close triceps press", "Face away, hands narrow, elbows tight to ribs, lower and press."]]
    ]},
    { key: "pull", title: "Pull", warm: ["Arm circles", "Light rows"], slots: [
      [[3, "TRX low row", "Body straight, pull chest to hands. Walk feet in to make it harder."],
       [1, "Reverse-grip row", "Palms up, elbows tight to ribs, pull hands to your waist."]],
      [[2, "High row", "Elbows up at shoulder height, pull hands beside your chest."],
       [2, "Face pull", "Pull handles to your forehead, elbows high and wide."]],
      [[2, "Y raise", "Arms straight, raise into a Y overhead. Lead with your thumbs."],
       [2, "T fly", "Arms straight, open wide into a T. Squeeze your shoulder blades."],
       [1, "Power pull", "One handle, rotate open, then pull and twist up. Switch arms halfway."]],
      [[3, "Biceps curl", "Face the anchor, elbows high and still, curl hands to temples."],
       [1, "Hammer curl", "Palms facing each other, elbows fixed, curl toward shoulders."]]
    ]},
    { key: "legs", title: "Legs", warm: ["Assisted squats", "Leg swings"], slots: [
      [[3, "TRX squat", "Light grip, sit back deep, drive through heels."],
       [1, "Jump squat", "Hold the straps, sit back, explode up, land soft."]],
      [[2, "Reverse lunge", "Alternate legs, back knee toward floor, straps for balance."],
       [2, "Suspended lunge", "Back foot in a cradle, drop straight down. Switch legs halfway."],
       [1, "Lateral lunge", "Step wide, sit into one hip, keep the other leg straight."]],
      [[3, "Hamstring curl", "On your back, heels in cradles, hips up, pull heels in."],
       [1, "Hip press", "Heels in cradles, drive hips up, squeeze glutes, lower slowly."]],
      [[2, "Assisted pistol squat", "One leg out front, sit back slowly. Switch legs halfway."],
       [1, "Hip press", "Heels in cradles, drive hips up, squeeze glutes, lower slowly."],
       [1, "Calf raise", "Lean into the straps, rise high on your toes, lower slowly."]]
    ]},
    { key: "full", title: "Full body", warm: ["Assisted squats", "Arm circles"], slots: [
      [[3, "Squat to row", "Squat down with arms long, stand and row in one motion."],
       [1, "Jump squat", "Hold the straps, sit back, explode up, land soft."]],
      [[2, "TRX chest press", "Face away, body in a plank, lower chest to hands, press out."],
       [2, "Atomic push-up", "Feet in cradles. One push-up, then pull knees to chest."]],
      [[3, "TRX low row", "Body straight, pull chest to hands. Walk feet in to make it harder."],
       [1, "Power pull", "One handle, rotate open, then pull and twist up. Switch arms halfway."]],
      [[2, "Reverse lunge", "Alternate legs, back knee toward floor, straps for balance."],
       [2, "Hamstring curl", "On your back, heels in cradles, hips up, pull heels in."],
       [1, "Lateral lunge", "Step wide, sit into one hip, keep the other leg straight."]]
    ]}
  ];

  // Abs rotate by day (7 moves; 7 and 4 share no factor, so each day type cycles through all of them).
  var ABS = [
    ["TRX plank", "Feet in cradles, hips level, squeeze glutes. Regular plank is fine."],
    ["Knee tuck", "Feet in cradles, plank position, pull knees to chest, push back out."],
    ["Pike", "Feet in cradles, straight legs, lift hips high, lower with control."],
    ["Body saw", "Feet in cradles, forearm plank, rock slowly forward and back."],
    ["Side plank", "Stack hips and feet, push the floor away. Switch sides halfway."],
    ["Mountain climbers", "Feet in cradles, drive knees in, hips low, steady pace."],
    ["Standing fallout", "Arms straight, lean forward reaching overhead, pull back up."]
  ];

  var WARM = {
    "Arm circles": "Big, slow circles both directions.",
    "Overhead reach": "Hold the straps, reach overhead and down, open the chest.",
    "Light rows": "Stand nearly upright, easy smooth rows.",
    "Assisted squats": "Hold the straps, sit back, stand tall.",
    "Leg swings": "Hold a strap, swing front to back. Switch legs halfway."
  };

  // ---- Helpers ----
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dateKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseKey(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dayNumber(k) { var d = parseKey(k); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
  function mod(a, n) { return ((a % n) + n) % n; }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function pickWeighted(opts, r, used) {
    var pool = opts.filter(function (o) { return !used[o[1]]; });
    if (!pool.length) pool = opts;
    var tot = pool.reduce(function (a, o) { return a + o[0]; }, 0), x = r() * tot;
    for (var i = 0; i < pool.length; i++) { x -= pool[i][0]; if (x < 0) break; }
    var o = pool[Math.min(i, pool.length - 1)]; used[o[1]] = true;
    return { name: o[1], cue: o[2] };
  }

  function dayInfo(key) {
    var n = dayNumber(key) - dayNumber(ANCHOR);
    return { n: n, type: mod(n, 4), cycle: Math.floor(n / 4) };
  }

  // Build the plan for a local date key ("YYYY-MM-DD").
  function planFor(key) {
    var info = dayInfo(key), day = DAYS[info.type];
    var r = rng(hash("trx2:" + day.key + ":" + info.cycle)), used = {};
    // Even cycles use the staple (most proven) move in each slot; odd cycles draw by weight for variety.
    var staple = mod(info.cycle, 2) === 0;
    var moves = day.slots.map(function (slot) {
      if (staple) { var o = slot.filter(function (x) { return !used[x[1]]; })[0] || slot[0]; used[o[1]] = true; return { name: o[1], cue: o[2] }; }
      return pickWeighted(slot, r, used);
    });
    var ab = ABS[mod(info.n, ABS.length)];
    moves.push({ name: ab[0], cue: ab[1], abs: true });

    // Straight sets: all sets of one exercise, then the next. Warm-up first.
    var steps = [], nW = day.warm.length;
    day.warm.forEach(function (w, i) { steps.push({ name: w, cue: WARM[w], secs: 30, kind: "warm", label: "Warm-up", ex: -1, set: i + 1, sets: nW }); });
    moves.forEach(function (m, k) {
      var exLabel = "Exercise " + (k + 1) + " of " + moves.length;
      for (var s = 1; s <= SETS; s++) {
        steps.push({ name: m.name, cue: m.cue, secs: WORK, kind: "work", label: exLabel, ex: k, set: s, sets: SETS });
        if (s < SETS) steps.push({ name: "Rest", cue: "", secs: REST, kind: "rest", label: exLabel, ex: k, set: s + 1, sets: SETS });
        else if (k < moves.length - 1) steps.push({ name: "Rest", cue: "", secs: REST, kind: "rest", label: "Exercise " + (k + 2) + " of " + moves.length, ex: k + 1, set: 1, sets: SETS });
      }
    });
    var total = steps.reduce(function (a, x) { return a + x.secs; }, 0);
    return {
      key: key, focus: day.title, focusKey: day.key, dayOfCycle: info.type + 1,
      moves: moves.map(function (m) { return m.name; }), warm: day.warm, steps: steps, total: total,
      sig: hash(steps.map(function (x) { return x.name + x.secs; }).join("|"))
    };
  }

  root.TRX = { planFor: planFor, dateKey: dateKey, parseKey: parseKey, dayNumber: dayNumber, DAYS: DAYS, ABS: ABS, WORK: WORK, REST: REST };
  if (typeof module !== "undefined") module.exports = root.TRX;
})(typeof window !== "undefined" ? window : globalThis);
