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
       [1, "Staggered chest press", "One foot forward, press out, switch feet each set."],
       [1, "Single-arm chest press", "One handle, square hips, lower and press. Switch arms halfway."],
       [1, "Push-up", "Hands under shoulders, body rigid, chest to floor. Knees down is fine."]],
      [[2, "TRX push-up", "Feet in cradles, body rigid, lower chest to floor. Knees down is fine."],
       [2, "Atomic push-up", "Feet in cradles. One push-up, then pull knees to chest."],
       [1, "Wide push-up", "Hands wider than shoulders, elbows out at 45, chest to floor."],
       [1, "Hindu push-up", "Hips high, swoop chest low between hands, arch up. Reverse back."],
       [1, "Spiderman push-up", "Lower down while bringing one knee to the elbow. Alternate sides."]],
      [[2, "Chest fly", "Face away, soft elbows, open wide, hug the straps back together."],
       [1, "Pike push-up", "Feet in cradles, hips high, lower head between hands, press up."],
       [1, "Archer push-up", "Hands very wide, shift down over one arm, other arm straight. Alternate."]],
      [[3, "Triceps extension", "Face away, elbows by ears, bend to forehead, press straight."],
       [1, "Close triceps press", "Face away, hands narrow, elbows tight to ribs, lower and press."],
       [1, "Diamond push-up", "Hands together under your chest, elbows tight, lower and press."],
       [1, "TRX triceps dip", "Hold the handles at your sides, legs out front, dip and press up."]]
    ]},
    { key: "pull", title: "Pull", warm: ["Arm circles", "Light rows"], slots: [
      [[3, "TRX low row", "Body straight, pull chest to hands. Walk feet in to make it harder."],
       [1, "Reverse-grip row", "Palms up, elbows tight to ribs, pull hands to your waist."],
       [1, "Single-arm row", "One handle, square hips, pull to your ribs. Switch arms halfway."],
       [1, "Wide row", "Palms down, elbows wide at shoulder height, pull chest to hands."]],
      [[2, "High row", "Elbows up at shoulder height, pull hands beside your chest."],
       [2, "Face pull", "Pull handles to your forehead, elbows high and wide."],
       [1, "Assisted pull-up", "Sit under the anchor, straps short, pull chest up using legs lightly."]],
      [[2, "Y raise", "Arms straight, raise into a Y overhead. Lead with your thumbs."],
       [2, "T fly", "Arms straight, open wide into a T. Squeeze your shoulder blades."],
       [1, "Power pull", "One handle, rotate open, then pull and twist up. Switch arms halfway."],
       [1, "W raise", "Lean back, pull elbows down and back into a W. Squeeze shoulder blades."],
       [1, "Superman", "Face down on the floor, lift arms, chest and legs. Hold, lower slowly."]],
      [[3, "Biceps curl", "Face the anchor, elbows high and still, curl hands to temples."],
       [1, "Hammer curl", "Palms facing each other, elbows fixed, curl toward shoulders."],
       [1, "Single-arm curl", "One handle, elbow high and still, curl to your temple. Switch arms."]]
    ]},
    { key: "legs", title: "Legs", warm: ["Assisted squats", "Leg swings"], slots: [
      [[3, "TRX squat", "Light grip, sit back deep, drive through heels."],
       [1, "Jump squat", "Hold the straps, sit back, explode up, land soft."],
       [1, "Sumo squat", "Wide stance, toes out, sit straight down, knees track over toes."]],
      [[2, "Reverse lunge", "Alternate legs, back knee toward floor, straps for balance."],
       [2, "Suspended lunge", "Back foot in a cradle, drop straight down. Switch legs halfway."],
       [1, "Lateral lunge", "Step wide, sit into one hip, keep the other leg straight."],
       [1, "Curtsy lunge", "Step one leg behind and across, sink, drive back up. Alternate."],
       [1, "Jump lunge", "Hold the straps, lunge, jump and switch legs in the air, land soft."]],
      [[3, "Hamstring curl", "On your back, heels in cradles, hips up, pull heels in."],
       [1, "Hip press", "Heels in cradles, drive hips up, squeeze glutes, lower slowly."],
       [1, "Single-leg hamstring curl", "Both heels in cradles, hips up, curl with one leg. Switch halfway."],
       [1, "Glute bridge", "On your back, feet flat, drive hips up, squeeze, lower slowly."]],
      [[2, "Assisted pistol squat", "One leg out front, sit back slowly. Switch legs halfway."],
       [1, "Hip press", "Heels in cradles, drive hips up, squeeze glutes, lower slowly."],
       [1, "Calf raise", "Lean into the straps, rise high on your toes, lower slowly."],
       [1, "Single-leg deadlift", "Hold the straps, hinge on one leg, back leg long. Switch halfway."],
       [1, "Skater", "Hop side to side, land on one foot, swing arms. Stay low."]]
    ]},
    { key: "full", title: "Full body", warm: ["Assisted squats", "Arm circles"], slots: [
      [[3, "Squat to row", "Squat down with arms long, stand and row in one motion."],
       [1, "Jump squat", "Hold the straps, sit back, explode up, land soft."],
       [1, "Burpee", "Squat, hands down, jump feet back, jump in, jump up. Step it if needed."],
       [1, "Sumo squat", "Wide stance, toes out, sit straight down, knees track over toes."]],
      [[2, "TRX chest press", "Face away, body in a plank, lower chest to hands, press out."],
       [2, "Atomic push-up", "Feet in cradles. One push-up, then pull knees to chest."],
       [1, "Push-up", "Hands under shoulders, body rigid, chest to floor. Knees down is fine."],
       [1, "Hindu push-up", "Hips high, swoop chest low between hands, arch up. Reverse back."]],
      [[3, "TRX low row", "Body straight, pull chest to hands. Walk feet in to make it harder."],
       [1, "Power pull", "One handle, rotate open, then pull and twist up. Switch arms halfway."],
       [1, "Single-arm row", "One handle, square hips, pull to your ribs. Switch arms halfway."],
       [1, "Assisted pull-up", "Sit under the anchor, straps short, pull chest up using legs lightly."]],
      [[2, "Reverse lunge", "Alternate legs, back knee toward floor, straps for balance."],
       [2, "Hamstring curl", "On your back, heels in cradles, hips up, pull heels in."],
       [1, "Lateral lunge", "Step wide, sit into one hip, keep the other leg straight."],
       [1, "Skater", "Hop side to side, land on one foot, swing arms. Stay low."],
       [1, "Glute bridge", "On your back, feet flat, drive hips up, squeeze, lower slowly."],
       [1, "Jump lunge", "Hold the straps, lunge, jump and switch legs in the air, land soft."]]
    ]}
  ];

  // Abs rotate by day. The pool size is odd (shares no factor with the 4-day cycle), so each day type
  // cycles through all of them. The first 7 keep their original order so earlier/saved days are unchanged.
  var ABS = [
    ["TRX plank", "Feet in cradles, hips level, squeeze glutes. Regular plank is fine."],
    ["Knee tuck", "Feet in cradles, plank position, pull knees to chest, push back out."],
    ["Pike", "Feet in cradles, straight legs, lift hips high, lower with control."],
    ["Body saw", "Feet in cradles, forearm plank, rock slowly forward and back."],
    ["Side plank", "Stack hips and feet, push the floor away. Switch sides halfway."],
    ["Mountain climbers", "Feet in cradles, drive knees in, hips low, steady pace."],
    ["Standing fallout", "Arms straight, lean forward reaching overhead, pull back up."],
    ["Sit-ups", "Knees bent, feet flat, curl all the way up, lower with control."],
    ["Bicycle crunches", "Hands by ears, elbow to opposite knee, other leg long. Slow and steady."],
    ["Oblique knee tuck", "Feet in cradles, plank, tuck both knees toward one elbow. Alternate."],
    ["Leg raises", "On your back, legs straight, lower toward the floor, raise back up."],
    ["Hollow hold", "Low back pressed down, arms and legs long, hover. Hold and breathe."],
    ["Plank", "Forearms under shoulders, body straight, squeeze glutes and abs."],
    ["Crunches", "Knees bent, lift shoulder blades off the floor, exhale, lower slowly."],
    ["Flutter kicks", "On your back, legs straight and low, small fast kicks, low back down."],
    ["Russian twists", "Sit leaning back, feet up or down, rotate side to side."],
    ["V-ups", "Lie long, lift arms and legs together to touch toes, lower slowly."],
    ["Dead bugs", "On your back, arms up, knees at 90. Lower opposite arm and leg, return."],
    ["Reverse crunch", "On your back, knees bent, curl hips off the floor toward chest."],
    ["Plank shoulder taps", "High plank, feet wide, tap opposite shoulder without rocking hips."],
    ["Heel taps", "On your back, knees bent, shoulders up, reach side to side to tap heels."],
    ["Windshield wipers", "On your back, arms out, knees up, lower them side to side with control."],
    ["Bird dog", "On hands and knees, reach opposite arm and leg long, return. Alternate."]
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
  // name -> cue lookup for every main and abs move
  var CUES = {};
  DAYS.forEach(function (d) { d.slots.forEach(function (sl) { sl.forEach(function (o) { CUES[o[1]] = o[2]; }); }); });
  ABS.forEach(function (a) { CUES[a[0]] = a[1]; });
  function dayPool(type) { var seen = {}, out = []; DAYS[type].slots.forEach(function (sl) { sl.forEach(function (o) { if (!seen[o[1]]) { seen[o[1]] = 1; out.push(o[1]); } }); }); return out; }
  function isAbs(name) { return ABS.some(function (a) { return a[0] === name; }); }

  // Swap candidates for one slot (0-3 main, 4 abs): same day-type pool (or abs pool), no duplicates within the day.
  // bans: optional list of move names the user never wants picked (they still apply if every option is banned).
  function swapOptions(key, slot, currentMoves, bans) {
    var pool = slot === 4 ? ABS.map(function (a) { return a[0]; }) : dayPool(dayInfo(key).type);
    var out = pool.filter(function (n) { return currentMoves.indexOf(n) === -1; });
    var ok = out.filter(function (n) { return !(bans && bans.indexOf(n) !== -1); });
    return ok.length ? ok : out;
  }

  // overrides: optional { slotIndex: moveName } (user swaps), applied after the normal pick.
  function planFor(key, overrides, bans) {
    var info = dayInfo(key), day = DAYS[info.type];
    var r = rng(hash("trx2:" + day.key + ":" + info.cycle)), used = {};
    var banned = {}; (bans || []).forEach(function (n) { banned[n] = true; });
    function allowed(slot) { var s = slot.filter(function (x) { return !banned[x[1]]; }); return s.length ? s : slot; }
    // Even cycles use the staple (most proven) move in each slot; odd cycles draw by weight for variety.
    var staple = mod(info.cycle, 2) === 0;
    var moves = day.slots.map(function (slot) {
      slot = allowed(slot);
      if (staple) { var o = slot.filter(function (x) { return !used[x[1]]; })[0] || slot[0]; used[o[1]] = true; return { name: o[1], cue: o[2] }; }
      return pickWeighted(slot, r, used);
    });
    var ai = mod(info.n, ABS.length);
    for (var t = 0; t < ABS.length && banned[ABS[ai][0]]; t++) ai = mod(ai + 1, ABS.length); // skip banned abs moves
    var ab = ABS[ai];
    moves.push({ name: ab[0], cue: ab[1], abs: true });
    if (overrides) {
      var dayNames = dayPool(info.type);
      Object.keys(overrides).forEach(function (k) {
        var i = +k, n = overrides[k];
        if (!(i >= 0 && i < moves.length) || !CUES[n]) return;
        if (i === 4 ? !isAbs(n) : dayNames.indexOf(n) === -1) return; // must fit the slot's pool
        if (moves.some(function (m, j) { return j !== i && m.name === n; })) return; // no duplicates
        moves[i] = { name: n, cue: CUES[n], abs: i === 4, swapped: true };
      });
    }

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

  root.TRX = { planFor: planFor, swapOptions: swapOptions, dateKey: dateKey, parseKey: parseKey, dayNumber: dayNumber, DAYS: DAYS, ABS: ABS, WORK: WORK, REST: REST };
  if (typeof module !== "undefined") module.exports = root.TRX;
})(typeof window !== "undefined" ? window : globalThis);
