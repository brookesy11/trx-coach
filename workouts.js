/* TRX Coach - deterministic daily workout generator. No network, no daily updates. */
(function (root) {
  "use strict";

  // ---- Exercise library (one-line cues) ----
  var LIB = {
    pull: [
      { name: "TRX row", cue: "Body straight, pull chest to hands. Walk feet in to make it harder." },
      { name: "Wide row", cue: "Elbows out at shoulder height, squeeze shoulder blades together." },
      { name: "Single-arm row", cue: "One handle, don't twist. Switch arms halfway." },
      { name: "Y raise", cue: "Arms straight, raise into a Y overhead. Lead with your thumbs." },
      { name: "T raise", cue: "Arms straight, open wide into a T. Squeeze your upper back." },
      { name: "Face pull", cue: "Pull handles to your forehead, elbows high and wide." }
    ],
    push: [
      { name: "TRX chest press", cue: "Face away, brace your core, lower like a push-up." },
      { name: "Atomic push-up", cue: "Feet in cradles. One push-up, then pull knees to chest." },
      { name: "Chest fly", cue: "Face away, arms slightly bent, open wide, hug back in." },
      { name: "Push-up, feet in straps", cue: "Hips level, lower chest to floor. Knees down is fine." },
      { name: "Staggered chest press", cue: "One foot forward for balance, press out, switch feet halfway." }
    ],
    arms: [
      { name: "Biceps curl", cue: "Face the anchor, elbows high and still, curl hands to temples." },
      { name: "Triceps extension", cue: "Face away, elbows by your ears, bend and press out straight." },
      { name: "Hammer curl", cue: "Palms facing each other, elbows fixed, curl toward shoulders." },
      { name: "Triceps press", cue: "Face away, lower your forehead toward the handles, press back." }
    ],
    legs: [
      { name: "TRX squat", cue: "Light grip, sit back deep, drive through heels." },
      { name: "Reverse lunge", cue: "Alternate legs, back knee toward floor, straps for balance." },
      { name: "Hamstring curl", cue: "On your back, heels in cradles, hips up, pull heels in." },
      { name: "Hip hinge", cue: "Soft knees, push hips back, flat back, stand tall and squeeze." },
      { name: "Suspended lunge", cue: "Back foot in a cradle, drop straight down. Switch legs halfway." },
      { name: "Lateral lunge", cue: "Step wide, sit into one hip, keep the other leg straight." },
      { name: "Glute bridge", cue: "Heels in cradles, drive hips up, pause, lower slowly." },
      { name: "Assisted single-leg squat", cue: "One leg out front, sit back slowly. Switch legs halfway." }
    ],
    core: [
      { name: "TRX plank", cue: "Feet in cradles, hips level. Regular plank is fine too." },
      { name: "Side plank", cue: "Stack hips and feet, push the floor away. Switch sides halfway." },
      { name: "Pike", cue: "Feet in cradles, straight legs, lift hips high, lower with control." },
      { name: "Knee tuck", cue: "Feet in cradles, plank position, pull knees to chest." },
      { name: "Body saw", cue: "Feet in cradles, forearm plank, rock slowly forward and back." },
      { name: "Standing fallout", cue: "Arms straight, lean forward reaching overhead, pull back up." },
      { name: "Oblique crunch", cue: "Feet in cradles, pull both knees toward one elbow, alternate." }
    ],
    cardio: [
      { name: "Jump squat", cue: "Hold the straps, sit back, explode up, land soft." },
      { name: "Mountain climbers", cue: "Feet in cradles, drive knees in fast, hips stay low." },
      { name: "Squat to row", cue: "Squat down with arms long, stand and row in one motion." },
      { name: "Skater hops", cue: "Hold the straps, hop side to side, land on one soft knee." },
      { name: "Sprinter start", cue: "Face away, lean, drive one knee up fast. Switch legs halfway." },
      { name: "Power pull", cue: "Single arm, rotate open, then pull up hard. Switch halfway." }
    ],
    mobility: [
      { name: "Deep squat hold", cue: "Hold the straps, sink low, chest tall, breathe." },
      { name: "Hip hinge, slow", cue: "Three seconds down, three seconds up. Long spine." },
      { name: "Y raise, easy", cue: "Big lean-back angle, slow controlled raise." },
      { name: "Rotational row", cue: "One handle, open your chest to the side, rotate back in." },
      { name: "Slow reverse lunge", cue: "Use the straps, sink deep, feel the hip stretch." },
      { name: "Glute bridge", cue: "Heels in cradles, drive hips up, pause, lower slowly." },
      { name: "Lateral lunge, slow", cue: "Sit into one hip, pause, push back. Easy pace." },
      { name: "Overhead reach", cue: "Hold the straps, lean back, reach long through the lats." }
    ]
  };

  var WARM = [
    { name: "Arm circles", cue: "Big, slow circles both directions." },
    { name: "Assisted squats", cue: "Hold the straps, sit back, stand tall." },
    { name: "Torso twists", cue: "Rotate from the ribs, hips stay square." },
    { name: "March in place", cue: "Knees up, arms swinging." },
    { name: "Leg swings", cue: "Hold a strap, swing front to back. Switch halfway." },
    { name: "Hip circles", cue: "Hands on hips, big slow circles both ways." },
    { name: "Shoulder rolls", cue: "Roll up, back and down. Then forward." },
    { name: "Assisted lunges", cue: "Hold the straps, easy alternating lunges." },
    { name: "Light rows", cue: "Stand nearly upright, easy smooth rows." }
  ];

  var COOL = [
    { name: "Chest stretch", cue: "Hold the straps, step forward, open the chest." },
    { name: "Hamstring stretch", cue: "Heel forward, hinge at the hips, breathe." },
    { name: "Hip flexor stretch", cue: "Half kneel, squeeze the back glute, shift forward." },
    { name: "Lat stretch", cue: "Hold the straps, sit hips back, let your arms reach long." },
    { name: "Quad stretch", cue: "Hold a strap for balance, heel to glute. Switch halfway." },
    { name: "Figure-4 stretch", cue: "Hold the straps, ankle over knee, sit back. Switch halfway." },
    { name: "Calf stretch", cue: "Lean into the straps, back heel down. Switch halfway." }
  ];

  var FINISH = {
    plank: { name: "TRX plank", cue: "Feet in cradles, hips level. Regular plank is fine too." },
    climbers: { name: "Mountain climbers", cue: "Steady pace, hips low. Walk them if you need to." },
    sideplank: { name: "Side plank", cue: "Stack hips, push the floor away. Switch sides halfway." },
    squathold: { name: "Wall-sit squat hold", cue: "Hold the straps, thighs parallel, breathe." },
    hollow: { name: "Body saw", cue: "Small slow rocks in a forearm plank. Breathe." },
    deepsquat: { name: "Deep squat hold", cue: "Sink low, chest tall, relax into it." }
  };

  // ---- Weekly focus rotation, indexed by local weekday (0 = Sunday) ----
  var FOCUS = [
    { key: "mobility", title: "Easy mobility", slots: ["mobility", "mobility", "mobility", "mobility"], finisher: "deepsquat", easy: true },
    { key: "full", title: "Full body", slots: ["pull", "legs", "push", "core"], finisher: "plank" },
    { key: "upper", title: "Upper body", slots: ["pull", "push", "arms", "pull"], finisher: "plank" },
    { key: "lower", title: "Lower body & core", slots: ["legs", "core", "legs", "core"], finisher: "squathold" },
    { key: "cond", title: "Conditioning", slots: ["cardio", "pull", "cardio", "legs"], finisher: "climbers" },
    { key: "full2", title: "Full body", slots: ["push", "legs", "pull", "core"], finisher: "sideplank" },
    { key: "core", title: "Core & posture", slots: ["pull", "core", "legs", "core"], finisher: "hollow" }
  ];

  // ---- Helpers ----
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dateKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseKey(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dayNumber(k) { var d = parseKey(k); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function pick(list, r, used) {
    var pool = list.filter(function (m) { return !used[m.name]; });
    if (!pool.length) pool = list;
    var m = pool[Math.floor(r() * pool.length)];
    used[m.name] = true; return m;
  }

  // Gentle progression from the first day the app was opened.
  function level(weeks, easy) {
    if (easy) return { work: 40, rest: 20, finish: 60, label: "Easy" };
    if (weeks >= 6) return { work: 45, rest: 15, finish: 75, label: "Level 3" };
    if (weeks >= 3) return { work: 45, rest: 15, finish: 60, label: "Level 2" };
    return { work: 40, rest: 20, finish: 60, label: "Level 1" };
  }

  // Build the plan for a local date key ("YYYY-MM-DD"). startKey = first-use date.
  function planFor(key, startKey) {
    var d = parseKey(key);
    var focus = FOCUS[d.getDay()];
    var weeks = Math.max(0, Math.floor((dayNumber(key) - dayNumber(startKey || key)) / 7));
    var lv = level(weeks, focus.easy);
    var r = rng(hash("trx:" + key));
    var used = {};

    var warm = []; var wu = {};
    for (var i = 0; i < 4; i++) warm.push(pick(WARM, r, wu));
    var moves = focus.slots.map(function (cat) { return pick(LIB[cat], r, used); });
    var cool = []; var cu = {};
    var nCool = focus.easy ? 4 : 3;
    for (var j = 0; j < nCool; j++) cool.push(pick(COOL, r, cu));

    var steps = [];
    warm.forEach(function (m) { steps.push({ name: m.name, cue: m.cue, secs: 30, kind: "warm", label: "Warm-up" }); });
    for (var rd = 1; rd <= 3; rd++) {
      moves.forEach(function (m, k) {
        steps.push({ name: m.name, cue: m.cue, secs: lv.work, kind: "work", label: "Round " + rd + " of 3" });
        if (k < moves.length - 1) steps.push({ name: "Rest", cue: "Next: " + moves[k + 1].name, secs: lv.rest, kind: "rest", label: "Round " + rd + " of 3" });
      });
      if (rd < 3) steps.push({ name: "Rest", cue: "Shake it out. Round " + (rd + 1) + " next.", secs: 30, kind: "rest", label: "Between rounds" });
    }
    var f = FINISH[focus.finisher];
    steps.push({ name: f.name, cue: f.cue, secs: lv.finish, kind: "finish", label: "Finisher" });
    cool.forEach(function (m) { steps.push({ name: m.name, cue: m.cue, secs: 30, kind: "cool", label: "Cool-down" }); });

    var total = steps.reduce(function (a, s) { return a + s.secs; }, 0);
    return { key: key, focus: focus.title, focusKey: focus.key, week: weeks + 1, level: lv.label, moves: moves.map(function (m) { return m.name; }), steps: steps, total: total };
  }

  root.TRX = { planFor: planFor, dateKey: dateKey, parseKey: parseKey, dayNumber: dayNumber, LIB: LIB, FOCUS: FOCUS };
  if (typeof module !== "undefined") module.exports = root.TRX;
})(typeof window !== "undefined" ? window : globalThis);
