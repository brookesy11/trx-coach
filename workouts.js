/* TRX Coach - deterministic daily workout generator. No network, no daily updates.
   4-day cycle: Push, Pull, Legs, Full body, repeating on a continuous local-day count.
   Anchor: Wed 2026-11-18 = Push. Each session: 1-min warm-up + 5 moves x 3 straight sets, 45s work / 15s rest.
   Slot-based library (TRX + floor bodyweight only):
     slot 1 PRIMARY compound, slot 2 SECONDARY compound, slots 3-4 ACCESSORY, slot 5 ABS finisher (shared). */
(function (root) {
  "use strict";

  var ANCHOR = "2026-11-18"; // Push day
  var WORK = 45, REST = 15, SETS = 3;

  // Options are [weight, name, cue]. Higher weight = staple, picked more often.
  var DAYS = [
    { key: "push", title: "Push", warm: ["Arm circles", "Overhead reach"],
      primary: [
        [3, "TRX chest press", "Face away, body in a plank, lower chest to hands, press out."],
        [3, "Push-up", "Hands under shoulders, body rigid, chest to floor."],
        [2, "TRX decline push-up", "Feet in the straps, body rigid, chest to floor, press up."],
        [2, "Atomic push-up", "Feet in the straps. One push-up, then pull knees to chest."],
        [1, "TRX pike push-up", "Feet in the straps, hips high, lower head between hands, press up."],
        [1, "Single-arm chest press", "One handle, square hips, lower and press. Switch arms halfway."],
        [1, "Staggered chest press", "One foot forward, lower and press out. Switch feet each set."]],
      secondary: [
        [2, "TRX incline press", "Face away, more upright, hands at chest, press out and lock out."],
        [2, "Archer push-up", "Hands very wide, shift down over one arm, other arm straight. Alternate."],
        [2, "TRX triceps dip", "Handles at your hips, legs out front, dip and press up."],
        [2, "Wide push-up", "Hands wider than shoulders, chest to floor, press up."],
        [1, "Hindu push-up", "Hips high, swoop chest low between hands, arch up. Reverse back."],
        [1, "Spiderman push-up", "Lower while bringing one knee to the elbow. Alternate sides."],
        [1, "Single-arm chest press", "One handle, square hips, lower and press. Switch arms halfway."],
        [1, "Staggered chest press", "One foot forward, lower and press out. Switch feet each set."]],
      accessory: [
        [3, "Triceps extension", "Face away, elbows by ears, bend to forehead, press straight."],
        [2, "Chest fly", "Face away, soft elbows, open wide, hug the straps back together."],
        [2, "Y fly", "Face away, arms straight, lower into a Y overhead, pull back up."],
        [2, "Diamond push-up", "Hands together under your chest, elbows tight, lower and press."],
        [2, "Close triceps press", "Face away, hands narrow, elbows tight to ribs, lower and press."],
        [1, "Plyo push-up", "Lower, then press hard so your hands leave the floor. Land soft."],
        [1, "Pike push-up", "Hips high, lower your head between your hands, press back up."],
        [1, "Single-arm chest fly", "One handle, arm long, open out wide, squeeze back. Switch arms."]] },
    { key: "pull", title: "Pull", warm: ["Arm circles", "Light rows"],
      primary: [
        [3, "TRX low row", "Body straight, pull chest to hands. Walk feet in to make it harder."],
        [2, "Wide row", "Palms down, elbows wide at shoulder height, pull chest to hands."],
        [2, "Single-arm row", "One handle, square hips, pull to your ribs. Switch arms halfway."],
        [2, "Assisted pull-up", "Sit under the anchor, straps short, pull chest up using legs lightly."],
        [1, "Power pull", "One handle, rotate open, then pull and twist up. Switch arms halfway."],
        [1, "Reverse-grip row", "Palms up, elbows tight to ribs, pull hands to your waist."]],
      secondary: [
        [3, "High row", "Elbows up at shoulder height, pull hands beside your chest."],
        [2, "Reverse-grip row", "Palms up, elbows tight to ribs, pull hands to your waist."],
        [2, "Single-arm row", "One handle, square hips, pull to your ribs. Switch arms halfway."],
        [1, "Wide row", "Palms down, elbows wide at shoulder height, pull chest to hands."],
        [1, "Archer row", "Row with one arm while the other stays long. Alternate sides."],
        [1, "Power pull", "One handle, rotate open, then pull and twist up. Switch arms halfway."]],
      accessory: [
        [3, "Biceps curl", "Face the anchor, elbows high and still, curl hands to temples."],
        [2, "Hammer curl", "Palms facing each other, elbows fixed, curl toward shoulders."],
        [2, "Face pull", "Pull handles to your forehead, elbows high and wide."],
        [2, "Y raise", "Arms straight, raise into a Y overhead. Lead with your thumbs."],
        [2, "Rear delt fly", "Arms straight, open wide into a T. Squeeze your shoulder blades."],
        [1, "Single-arm curl", "One handle, elbow high and still, curl to your temple. Switch arms."],
        [1, "Reverse-grip curl", "Palms down, elbows high, curl toward your forehead."],
        [1, "W raise", "Lean back, pull elbows down and back into a W. Squeeze shoulder blades."],
        [1, "Superman", "Face down on the floor, lift arms, chest and legs. Hold, lower slowly."]] },
    { key: "legs", title: "Legs", warm: ["Assisted squats", "Leg swings"],
      primary: [
        [3, "TRX squat", "Light grip, sit back deep, drive through heels."],
        [3, "Bulgarian split squat", "Back foot in a cradle, drop straight down. Switch legs halfway."],
        [2, "TRX pistol squat", "One leg out front, sit all the way down, stand up. Switch halfway."],
        [2, "Reverse lunge", "Alternate legs, back knee toward floor, straps for balance."],
        [1, "Sprinter lunge", "Hold the straps, drop into a lunge, drive the back knee up. Switch halfway."],
        [1, "Jump squat", "Hold the straps, sit back, explode up, land soft."],
        [1, "Single-leg squat", "Stand on one leg, other foot just off the floor, squat to parallel."]],
      secondary: [
        [3, "Split squat", "Staggered stance, drop the back knee straight down, drive up. Switch."],
        [2, "Lateral lunge", "Step wide, sit into one hip, keep the other leg straight."],
        [2, "Skater", "Hop side to side, land on one foot, stay low."],
        [2, "Reverse lunge", "Alternate legs, back knee toward floor, straps for balance."],
        [1, "Curtsy lunge", "Step one leg behind and across, sink, drive back up. Alternate."],
        [1, "Sumo squat", "Wide stance, toes out, sit straight down, knees track over toes."],
        [1, "Single-leg deadlift", "Hold the straps, hinge on one leg, back leg long. Switch halfway."]],
      accessory: [
        [3, "Hamstring curl", "On your back, heels in cradles, hips up, pull heels in."],
        [2, "Hip press", "Heels in cradles, drive hips up, squeeze glutes, lower slowly."],
        [2, "Jump lunge", "Hold the straps, lunge, jump and switch legs in the air, land soft."],
        [2, "Calf raise", "Lean into the straps, rise high on your toes, lower slowly."],
        [1, "Single-leg hamstring curl", "Heels in cradles, hips up, curl with one leg. Switch halfway."],
        [1, "Squat hold", "Hold the straps, sit to thighs parallel and hold. Breathe."],
        [1, "Glute bridge", "On your back, feet flat, drive hips up, squeeze, lower slowly."],
        [1, "Single-leg glute bridge", "One foot flat, other leg up, drive hips up. Switch halfway."],
        [1, "Squat pulse", "Hold the straps, stay low and pulse up and down a few inches."]] },
    { key: "full", title: "Full body", warm: ["Assisted squats", "Arm circles"],
      primary: [
        [3, "Squat to row", "Squat down with arms long, stand and row in one motion."],
        [2, "Burpee", "Squat, hands down, jump feet back, jump in, jump up."],
        [2, "Squat press", "Face away, handles at shoulders, squat, stand and press up into a Y."],
        [1, "Push-up to pike", "Feet in the straps, one push-up, then pike hips high."],
        [1, "Atomic push-up", "Feet in the straps. One push-up, then pull knees to chest."],
        [1, "Jump squat", "Hold the straps, sit back, explode up, land soft."]],
      secondary: [
        [2, "TRX chest press", "Face away, body in a plank, lower chest to hands, press out."],
        [2, "TRX low row", "Body straight, pull chest to hands. Walk feet in to make it harder."],
        [2, "Push-up", "Hands under shoulders, body rigid, chest to floor."],
        [2, "Reverse lunge", "Alternate legs, back knee toward floor, straps for balance."],
        [1, "Power pull", "One handle, rotate open, then pull and twist up. Switch arms halfway."],
        [1, "Sprinter lunge", "Hold the straps, drop into a lunge, drive the back knee up. Switch halfway."],
        [1, "Single-arm row", "One handle, square hips, pull to your ribs. Switch arms halfway."]],
      accessory: [
        [2, "TRX mountain climber", "Feet in the straps, drive knees in fast, hips low."],
        [2, "Squat thrust", "Hands down, jump feet back to plank, jump them in, stand."],
        [2, "Skater", "Hop side to side, land on one foot, stay low."],
        [2, "Jump lunge", "Hold the straps, lunge, jump and switch legs in the air, land soft."],
        [2, "Hamstring curl", "On your back, heels in cradles, hips up, pull heels in."],
        [1, "Hip press", "Heels in cradles, drive hips up, squeeze glutes, lower slowly."],
        [1, "Biceps curl", "Face the anchor, elbows high and still, curl hands to temples."],
        [1, "Triceps extension", "Face away, elbows by ears, bend to forehead, press straight."],
        [1, "Plyo push-up", "Lower, then press hard so your hands leave the floor. Land soft."],
        [1, "Y raise", "Arms straight, raise into a Y overhead. Lead with your thumbs."]] }
  ];

  // Abs finisher: shared by every day type.
  var ABS = [
    [2, "Sit-ups", "Knees bent, feet flat, curl all the way up, lower with control."],
    [2, "Crunches", "Knees bent, lift shoulder blades off the floor, exhale, lower slowly."],
    [2, "Bicycle crunches", "Elbow to opposite knee, other leg long. Slow and steady."],
    [2, "Leg raises", "On your back, legs straight, lower toward the floor, raise back up."],
    [1, "Flutter kicks", "On your back, legs straight and low, small fast kicks."],
    [1, "V-ups", "Lie long, lift arms and legs together to touch toes, lower slowly."],
    [2, "Russian twists", "Sit leaning back, feet up or down, rotate side to side."],
    [2, "TRX knee tuck", "Feet in the straps, plank, pull knees to chest, push back out."],
    [2, "TRX pike", "Feet in the straps, straight legs, lift hips high, lower with control."],
    [1, "TRX body saw", "Feet in the straps, forearm plank, rock slowly forward and back."],
    [2, "Plank", "Forearms under shoulders, body straight, squeeze glutes and abs."],
    [1, "Side plank", "Stack hips and feet, push the floor away. Switch sides halfway."],
    [1, "TRX mountain climber", "Feet in the straps, drive knees in fast, hips low."],
    [1, "Windshield wipers", "On your back, knees up, lower them side to side with control."],
    [1, "Reverse crunch", "On your back, knees bent, curl hips off the floor toward chest."]
  ];

  // Near-identical moves: the daily plan never picks two from one family (a manual shuffle may).
  var FAMILY = {};
  [["Bulgarian split squat", "Split squat"], ["Hamstring curl", "Single-leg hamstring curl"],
   ["Hip press", "Glute bridge", "Single-leg glute bridge"], ["TRX chest press", "TRX incline press", "Single-arm chest press", "Staggered chest press"],
   ["Biceps curl", "Hammer curl", "Single-arm curl", "Reverse-grip curl"], ["Triceps extension", "Close triceps press", "Diamond push-up"],
   ["TRX squat", "Jump squat", "Squat hold", "Squat pulse", "Sumo squat"], ["Burpee", "Squat thrust"],
   ["TRX pike push-up", "Pike push-up", "Push-up to pike"], ["Chest fly", "Single-arm chest fly"], ["TRX pistol squat", "Single-leg squat"]
  ].forEach(function (g, i) { g.forEach(function (n) { FAMILY[n] = "f" + i; }); });

  // Dates whose plan is fixed (already generated and in progress on the device when the library changed).
  var FROZEN = { "2026-11-19": ["TRX low row", "High row", "Y raise", "Biceps curl", "Knee tuck"] };
  var LEGACY_CUES = { "Knee tuck": "Feet in cradles, plank position, pull knees to chest, push back out." };

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
  function dayInfo(key) { var n = dayNumber(key) - dayNumber(ANCHOR); return { n: n, type: mod(n, 4), cycle: Math.floor(n / 4) }; }

  // name -> cue for every move
  var CUES = {};
  DAYS.forEach(function (d) { ["primary", "secondary", "accessory"].forEach(function (c) { d[c].forEach(function (o) { if (!CUES[o[1]]) CUES[o[1]] = o[2]; }); }); });
  ABS.forEach(function (o) { if (!CUES[o[1]]) CUES[o[1]] = o[2]; });
  function cueOf(n) { return CUES[n] || LEGACY_CUES[n] || ""; }

  // The category list for a slot (0 primary, 1 secondary, 2-3 accessory, 4 abs) on a date.
  function slotList(key, slot) {
    var d = DAYS[dayInfo(key).type];
    return slot === 0 ? d.primary : slot === 1 ? d.secondary : slot === 4 ? ABS : d.accessory;
  }
  // Category id for custom moves: "push:primary", "legs:accessory", ... or "abs".
  var CATS = ["primary", "secondary", "accessory", "accessory"];
  function catKey(key, slot) { return slot === 4 ? "abs" : DAYS[dayInfo(key).type].key + ":" + CATS[slot]; }
  function low(n) { return String(n || "").toLowerCase(); }
  // Shipped spelling of a name in any category (case-insensitive), or "".
  function shippedName(n) { var l = low(n); for (var k in CUES) if (low(k) === l) return k; return ""; }
  // User-added moves: { catKey: [names] }. Only reachable by picking; the daily generator uses the shipped library.
  var CUSTOM = {};
  function setCustom(c) { CUSTOM = c && typeof c === "object" ? c : {}; }
  function slotOptions(key, slot) {
    var names = slotList(key, slot).map(function (o) { return o[1]; }), lows = names.map(low);
    (CUSTOM[catKey(key, slot)] || []).forEach(function (n) {
      if (typeof n !== "string" || !n) return;
      var s = shippedName(n) || n; if (lows.indexOf(low(s)) === -1) { names.push(s); lows.push(low(s)); }
    });
    return names;
  }

  // Shuffle candidates for one slot: that slot's category, minus moves already in the day, minus bans.
  function swapOptions(key, slot, currentMoves, bans) {
    return slotOptions(key, slot).filter(function (n) { return currentMoves.indexOf(n) === -1 && !(bans && bans.indexOf(n) !== -1); });
  }

  function pickWeighted(list, r, used, banned) {
    function free(o) { return !used[o[1]] && !(FAMILY[o[1]] && used[FAMILY[o[1]]]); }
    var pool = list.filter(function (o) { return free(o) && !banned[o[1]]; });
    if (!pool.length) pool = list.filter(function (o) { return !used[o[1]] && !banned[o[1]]; });
    if (!pool.length) pool = list.filter(function (o) { return !used[o[1]]; });
    if (!pool.length) pool = list;
    var tot = pool.reduce(function (a, o) { return a + o[0]; }, 0), x = r() * tot;
    for (var i = 0; i < pool.length; i++) { x -= pool[i][0]; if (x < 0) break; }
    var o = pool[Math.min(i, pool.length - 1)]; used[o[1]] = true; if (FAMILY[o[1]]) used[FAMILY[o[1]]] = true;
    return o[1];
  }

  // overrides: optional { slotIndex: moveName } (user swaps). bans: optional list of names never to pick.
  function planFor(key, overrides, bans) {
    var info = dayInfo(key), day = DAYS[info.type], names;
    if (FROZEN[key]) names = FROZEN[key].slice();
    else {
      var r = rng(hash("trx3:" + key)), used = {}, banned = {};
      (bans || []).forEach(function (n) { banned[n] = true; });
      names = [0, 1, 2, 3, 4].map(function (s) { return pickWeighted(slotList(key, s), r, used, banned); });
      if (overrides) Object.keys(overrides).forEach(function (k) {
        var i = +k, opts = (i >= 0 && i < 5) ? slotOptions(key, i) : [], j = opts.map(low).indexOf(low(overrides[k]));
        if (j === -1) return; // unknown / removed / wrong slot: ignored
        var n = opts[j]; // shipped spelling wins over a local placeholder
        if (names.some(function (m, j) { return j !== i && m === n; })) return; // never twice in a day
        names[i] = n;
      });
    }
    var moves = names.map(function (n, i) { return { name: n, cue: cueOf(n), abs: i === 4 }; });

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
      moves: names, warm: day.warm, steps: steps, total: total,
      sig: hash(steps.map(function (x) { return x.name + x.secs; }).join("|"))
    };
  }

  root.TRX = { planFor: planFor, swapOptions: swapOptions, slotOptions: slotOptions, catKey: catKey, shippedName: shippedName, setCustom: setCustom,
    catShipped: function (cat) {
      var p = String(cat).split(":"), d = DAYS.filter(function (x) { return x.key === p[0]; })[0];
      var list = cat === "abs" ? ABS : d && d[p[1]] && CATS.indexOf(p[1]) !== -1 ? d[p[1]] : null;
      return list ? list.map(function (o) { return o[1]; }) : null;
    },
    shippedOptions: function (key, slot) { return slotList(key, slot).map(function (o) { return o[1]; }); }, dateKey: dateKey, parseKey: parseKey, dayNumber: dayNumber,
    DAYS: DAYS, ABS: ABS, WORK: WORK, REST: REST };
  if (typeof module !== "undefined") module.exports = root.TRX;
})(typeof window !== "undefined" ? window : globalThis);
