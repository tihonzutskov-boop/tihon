// Top-view drawings of machines, as the owner sketched them: what each machine
// looks like from the ceiling, with its long side upright and its front (the
// console, the weights) at the top.
//
// Each drawing is a list of parts with a role (a pad, the frame, a bar…) in its
// own units; `u` is how many of those units make a centimetre, so lines come
// out equally thick on every machine. The zone's colour decides how a role
// looks, in three shades of it, so a machine reads as part of its zone.

// `roller` is the pad your legs push on, lighter than the seat; `mark` is a dark line
// and `ink` dark text, for the numbers and ticks on a sprint lane.
export type Role = 'pad' | 'plate' | 'frame' | 'soft' | 'rail' | 'bar' | 'deck' | 'step' | 'roller' | 'ink' | 'mark';
// A text part has its text as a fourth item.
export type Part = [Role, 'rect' | 'path' | 'circle' | 'ellipse' | 'text', Record<string, number | string>, string?];
export interface Drawing { size: [number, number]; u: number; parts: Part[] }

export type DrawnKind =
  | 'treadmill' | 'bike' | 'rower' | 'elliptical' | 'stairs' | 'rack' | 'bench' | 'dumbbells'
  | 'benchStation' | 'legPress' | 'smith' | 'functionalTrainer' | 'pulldown' | 'cableStation'
  | 'legExtension' | 'legCurl' | 'chestPress' | 'hipAbductor' | 'hipAdductor' | 'shoulderPress' | 'proneLegCurl'
  | 'plateChestPress' | 'plateLegExtension' | 'plateShoulderPress' | 'plateUpperChestPress' | 'plateLowRow'
  | 'kettlebellRack' | 'plyoBox' | 'sprintLane';

export const DRAWINGS: Record<Exclude<DrawnKind, 'dumbbells' | 'cableStation'>, Drawing> = {
  // The owner's sketch: the bar along the long side with a plate at each end,
  // two hooks, the bench under the bar.
  benchStation: { size: [234, 395], u: 1.75, parts: [
    ['pad', 'rect', { x: 26, y: 153, width: 67, height: 91, rx: 26 }],
    ['pad', 'rect', { x: 94, y: 164, width: 135, height: 68, rx: 22 }],
    ['bar', 'path', { d: 'M48 5V390' }],
    ['soft', 'rect', { x: 48, y: 75, width: 21, height: 22, rx: 3 }],
    ['soft', 'rect', { x: 48, y: 300, width: 21, height: 22, rx: 3 }],
    ['plate', 'rect', { x: 1, y: 8, width: 94, height: 24, rx: 10 }],
    ['plate', 'rect', { x: 1, y: 363, width: 94, height: 24, rx: 10 }]] },
  // The owner's sketch: four posts, two safety arms, a back rail, the bar with
  // its plates a little in from the ends so the bar shows past them.
  rack: { size: [245, 380], u: 1.75, parts: [
    ['rail', 'path', { d: 'M55 98H190M55 304H190' }],
    ['frame', 'rect', { x: 7, y: 74, width: 48, height: 48, rx: 4 }],
    ['frame', 'rect', { x: 190, y: 74, width: 48, height: 48, rx: 4 }],
    ['frame', 'rect', { x: 7, y: 280, width: 48, height: 48, rx: 4 }],
    ['frame', 'rect', { x: 190, y: 280, width: 48, height: 48, rx: 4 }],
    ['rail', 'path', { d: 'M30 93V311' }],
    ['bar', 'path', { d: 'M122 8V372' }],
    ['plate', 'rect', { x: 75, y: 30, width: 94, height: 24, rx: 10 }],
    ['plate', 'rect', { x: 75, y: 326, width: 94, height: 24, rx: 10 }]] },
  // The owner's sketch of the RPM Power Renegade: a station at each end with
  // two racks for the bar and two pull-up bars across, plate storage between.
  functionalTrainer: { size: [354, 922], u: 2.23, parts: [
    ['rail', 'path', { d: 'M73 6V276M281 6V276M73 646V916M281 646V916' }],
    ['bar', 'path', { d: 'M19 46H335M19 236H335M19 686H335M19 876H335' }],
    ...[46, 236, 686, 876].flatMap((y): Part[] => [3, 319].map((x): Part =>
      ['frame', 'rect', { x, y: y - 16, width: 32, height: 32, rx: 5 }])),
    ['frame', 'rect', { x: 124, y: 236, width: 106, height: 450, rx: 4 }],
    ...[305, 409, 513, 617].map((cy): Part => ['plate', 'circle', { cx: 177, cy, r: 35 }])] },
  legPress: { size: [180, 230], u: 1, parts: [
    ['rail', 'path', { d: 'M62 12V214M118 12V214' }],
    // The horns stick out past the plates, so the metal shows on both sides.
    ['bar', 'path', { d: 'M6 50H50M130 50H174' }],
    ['plate', 'rect', { x: 18, y: 24, width: 21, height: 52, rx: 6 }],
    ['plate', 'rect', { x: 141, y: 24, width: 21, height: 52, rx: 6 }],
    ['pad', 'rect', { x: 48, y: 16, width: 84, height: 66, rx: 10 }],
    ['pad', 'rect', { x: 56, y: 128, width: 68, height: 40, rx: 12 }],
    ['pad', 'rect', { x: 56, y: 172, width: 68, height: 52, rx: 14 }],
    ['bar', 'path', { d: 'M44 136V172M136 136V172' }]] },
  smith: { size: [140, 220], u: 1, parts: [
    ['rail', 'path', { d: 'M17 47H123V173H17Z' }],
    ...[[8, 38], [114, 38], [8, 164], [114, 164]].map(([x, y]): Part => ['frame', 'rect', { x, y, width: 18, height: 18, rx: 3 }]),
    ['soft', 'circle', { cx: 70, cy: 47, r: 8 }],
    ['soft', 'circle', { cx: 70, cy: 173, r: 8 }],
    ['bar', 'path', { d: 'M70 20V200' }],
    ['plate', 'rect', { x: 40, y: 6, width: 60, height: 16, rx: 6 }],
    ['plate', 'rect', { x: 40, y: 198, width: 60, height: 16, rx: 6 }]] },
  pulldown: { size: [120, 180], u: 1, parts: [
    ['rail', 'path', { d: 'M60 50V160' }],
    ['frame', 'rect', { x: 34, y: 6, width: 52, height: 44, rx: 6 }],
    ['pad', 'rect', { x: 44, y: 13, width: 32, height: 30, rx: 3 }],
    ['bar', 'path', { d: 'M8 66H112' }],
    ['pad', 'rect', { x: 28, y: 94, width: 64, height: 16, rx: 8 }],
    ['pad', 'rect', { x: 36, y: 122, width: 48, height: 46, rx: 12 }]] },
  treadmill: { size: [90, 210], u: 1, parts: [
    ['pad', 'rect', { x: 6, y: 22, width: 78, height: 184, rx: 10 }],
    ['deck', 'rect', { x: 18, y: 42, width: 54, height: 154, rx: 4 }],
    ['step', 'path', { d: 'M18 64H72M18 86H72M18 108H72M18 130H72M18 152H72M18 174H72' }],
    ['bar', 'path', { d: 'M10 26V84M80 26V84' }],
    ['frame', 'rect', { x: 3, y: 4, width: 84, height: 26, rx: 8 }],
    ['soft', 'rect', { x: 30, y: 10, width: 30, height: 12, rx: 3 }]] },
  // The owner's sketch: crank and pedals across, the handlebar's curve, the
  // saddle near the back.
  bike: { size: [293, 562], u: 4.68, parts: [
    ['bar', 'path', { d: 'M5 290H288' }],
    ['bar', 'path', { d: 'M18 90Q145 4 273 90' }],
    ['frame', 'rect', { x: 100, y: 5, width: 92, height: 55, rx: 12 }],
    ['pad', 'rect', { x: 82, y: 92, width: 131, height: 465, rx: 65 }],
    ['frame', 'ellipse', { cx: 146, cy: 467, rx: 57, ry: 85 }],
    ['pad', 'rect', { x: 29, y: 252, width: 32, height: 90, rx: 6 }],
    ['pad', 'rect', { x: 232, y: 252, width: 32, height: 90, rx: 6 }]] },
  rower: { size: [60, 240], u: 1, parts: [
    ['frame', 'rect', { x: 24, y: 40, width: 12, height: 194, rx: 6 }],
    ['pad', 'circle', { cx: 30, cy: 24, r: 22 }],
    ['soft', 'circle', { cx: 30, cy: 24, r: 9 }],
    ['pad', 'rect', { x: 4, y: 54, width: 18, height: 24, rx: 5 }],
    ['pad', 'rect', { x: 38, y: 54, width: 18, height: 24, rx: 5 }],
    ['bar', 'path', { d: 'M8 88H52' }],
    ['pad', 'rect', { x: 16, y: 134, width: 28, height: 28, rx: 8 }]] },
  // The owner's sketch: console up front, the body, the pedals and arms one
  // forward and one back, as they are mid-stride.
  elliptical: { size: [240, 557], u: 3.48, parts: [
    ['frame', 'rect', { x: 70, y: 91, width: 100, height: 460, rx: 45 }],
    ['frame', 'rect', { x: 60, y: 6, width: 120, height: 85, rx: 8 }],
    ['soft', 'rect', { x: 77, y: 46, width: 86, height: 42, rx: 6 }],
    ['pad', 'rect', { x: 5, y: 370, width: 65, height: 150, rx: 25 }],
    ['bar', 'path', { d: 'M33 250V372' }],
    ['pad', 'rect', { x: 18, y: 204, width: 47, height: 46, rx: 6 }],
    ['pad', 'rect', { x: 170, y: 300, width: 65, height: 150, rx: 25 }],
    ['bar', 'path', { d: 'M192 180V380' }],
    ['pad', 'rect', { x: 163, y: 136, width: 47, height: 44, rx: 6 }]] },
  stairs: { size: [90, 160], u: 1, parts: [
    ['pad', 'rect', { x: 6, y: 26, width: 78, height: 130, rx: 10 }],
    ['deck', 'rect', { x: 18, y: 44, width: 54, height: 102, rx: 4 }],
    ['step', 'path', { d: 'M18 64H72M18 84H72M18 104H72M18 124H72' }],
    ['bar', 'path', { d: 'M10 28V100M80 28V100' }],
    ['frame', 'rect', { x: 14, y: 4, width: 62, height: 26, rx: 8 }],
    ['soft', 'rect', { x: 32, y: 10, width: 26, height: 12, rx: 3 }]] },
  bench: { size: [60, 140], u: 1, parts: [
    ['pad', 'rect', { x: 8, y: 4, width: 44, height: 84, rx: 14 }],
    ['pad', 'rect', { x: 8, y: 92, width: 44, height: 44, rx: 14 }]] },
  // The owner's sketches of the weight-stack and plate-loaded machines, and the
  // functional kit, in the orientation they were drawn: the front is the top of each.
  // #20 Leg extension
  legExtension: { size: [332, 272], u: 2.75, parts: [
    ['rail', 'path', { d: 'M198 42V15H293V58' }],
    ['frame', 'rect', { x: 260, y: 58, width: 66, height: 194, rx: 8 }],
    ['pad', 'rect', { x: 275, y: 81, width: 36, height: 148, rx: 4 }],
    ['roller', 'rect', { x: 38, y: 43, width: 162, height: 35, rx: 17 }],
    ['pad', 'rect', { x: 38, y: 107, width: 162, height: 93, rx: 40 }],
    ['pad', 'rect', { x: 54, y: 203, width: 130, height: 64, rx: 28 }],
    ['bar', 'path', { d: 'M24 123V190M214 123V190' }]] },
  // #21 Leg curl (seated)
  legCurl: { size: [333, 302], u: 2.75, parts: [
    ['rail', 'path', { d: 'M181 42V8H293V88' }],
    ['frame', 'rect', { x: 260, y: 88, width: 66, height: 194, rx: 8 }],
    ['pad', 'rect', { x: 275, y: 111, width: 36, height: 148, rx: 4 }],
    ['roller', 'rect', { x: 53, y: 43, width: 132, height: 32, rx: 16 }],
    ['roller', 'rect', { x: 38, y: 89, width: 162, height: 35, rx: 17 }],
    ['pad', 'rect', { x: 38, y: 137, width: 162, height: 93, rx: 40 }],
    ['pad', 'rect', { x: 54, y: 233, width: 130, height: 64, rx: 28 }],
    ['bar', 'path', { d: 'M24 153V220M214 153V220' }]] },
  // #22 Chest press
  chestPress: { size: [445, 288], u: 2.75, parts: [
    ['frame', 'rect', { x: 353, y: 4, width: 86, height: 251, rx: 6 }],
    ['pad', 'rect', { x: 375, y: 35, width: 44, height: 189, rx: 4 }],
    ['rail', 'path', { d: 'M43 114L44 129L52 183L119 268L147 267' }],
    ['rail', 'path', { d: 'M301 114L300 129L292 183L225 268L198 267' }],
    ['soft', 'rect', { x: 4, y: 87, width: 75, height: 28, rx: 8 }],
    ['soft', 'rect', { x: 265, y: 87, width: 75, height: 28, rx: 8 }],
    ['pad', 'rect', { x: 91, y: 62, width: 162, height: 101, rx: 48 }],
    ['pad', 'rect', { x: 106, y: 165, width: 133, height: 71, rx: 36 }],
    ['frame', 'rect', { x: 147, y: 254, width: 51, height: 26, rx: 5 }]] },
  // #24 Hip abductor
  hipAbductor: { size: [364, 436], u: 3.45, parts: [
    ['rail', 'path', { d: 'M52 139H44V205M214 139H222V205' }],
    ['frame', 'rect', { x: 278, y: 199, width: 82, height: 233, rx: 10 }],
    ['pad', 'rect', { x: 296, y: 228, width: 46, height: 176, rx: 10 }],
    ['roller', 'rect', { x: 66, y: 6, width: 45, height: 45, rx: 10 }],
    ['roller', 'rect', { x: 155, y: 6, width: 45, height: 45, rx: 10 }],
    ['roller', 'rect', { x: 60, y: 60, width: 57, height: 133, rx: 28 }],
    ['roller', 'rect', { x: 149, y: 60, width: 57, height: 133, rx: 28 }],
    ['pad', 'rect', { x: 29, y: 207, width: 208, height: 131, rx: 60 }],
    ['pad', 'rect', { x: 54, y: 338, width: 158, height: 94, rx: 44 }],
    ['bar', 'path', { d: 'M12 239V325M254 239V325' }]] },
  // #30 Hip adductor
  hipAdductor: { size: [384, 432], u: 3.45, parts: [
    ['rail', 'path', { d: 'M27 145H19V205M239 145H247V205', transform: 'translate(16 -8)' }],
    ['frame', 'rect', { x: 278, y: 199, width: 82, height: 233, rx: 10, transform: 'translate(16 -8)' }],
    ['pad', 'rect', { x: 296, y: 228, width: 46, height: 176, rx: 10, transform: 'translate(16 -8)' }],
    ['roller', 'rect', { x: 66, y: 6, width: 45, height: 45, rx: 10, transform: 'translate(16 -8) rotate(-25 88.5 193)' }],
    ['roller', 'rect', { x: 155, y: 6, width: 45, height: 45, rx: 10, transform: 'translate(16 -8) rotate(25 177.5 193)' }],
    ['roller', 'rect', { x: 60, y: 60, width: 57, height: 133, rx: 28, transform: 'translate(16 -8) rotate(-25 88.5 193)' }],
    ['roller', 'rect', { x: 149, y: 60, width: 57, height: 133, rx: 28, transform: 'translate(16 -8) rotate(25 177.5 193)' }],
    ['pad', 'rect', { x: 29, y: 207, width: 208, height: 131, rx: 60, transform: 'translate(16 -8)' }],
    ['pad', 'rect', { x: 54, y: 338, width: 158, height: 94, rx: 44, transform: 'translate(16 -8)' }],
    ['bar', 'path', { d: 'M12 239V325M254 239V325', transform: 'translate(16 -8)' }]] },
  // #31 Shoulder press
  shoulderPress: { size: [420, 290], u: 3.56, parts: [
    ['frame', 'rect', { x: 324, y: 4, width: 88, height: 254, rx: 6 }],
    ['pad', 'rect', { x: 345, y: 34, width: 47, height: 193, rx: 4 }],
    ['rail', 'path', { d: 'M18.5 181L90 268L118 269' }],
    ['rail', 'path', { d: 'M269.5 181L198 268L170 269' }],
    ['rail', 'path', { d: 'M18.5 79V40H28M269.5 79V40H260' }],
    ['soft', 'rect', { x: 4, y: 78, width: 29, height: 105, rx: 13 }],
    ['soft', 'rect', { x: 255, y: 78, width: 29, height: 105, rx: 13 }],
    ['pad', 'rect', { x: 63, y: 63, width: 162, height: 103, rx: 50 }],
    ['pad', 'rect', { x: 77.5, y: 168, width: 133, height: 68, rx: 34 }],
    ['frame', 'rect', { x: 118, y: 255, width: 52, height: 29, rx: 5 }]] },
  // #32 Prone leg curl
  proneLegCurl: { size: [393, 643], u: 4.6, parts: [
    ['frame', 'rect', { x: 290, y: 271, width: 99, height: 303, rx: 8 }],
    ['pad', 'rect', { x: 313.5, y: 308, width: 52, height: 229, rx: 6 }],
    ['rail', 'path', { d: 'M249.5 613H339.5V574' }],
    ['rail', 'path', { d: 'M107.5 49V9M107.5 17H62M153.5 49V9M153.5 17H199' }],
    ['pad', 'rect', { x: 29, y: 49, width: 203, height: 362, rx: 100 }],
    ['pad', 'rect', { x: 4.5, y: 414, width: 252, height: 135, rx: 50 }],
    ['roller', 'rect', { x: 11.5, y: 587, width: 238, height: 52, rx: 26 }]] },
  // #33 Plate-loaded chest press
  plateChestPress: { size: [391, 252], u: 2.75, parts: [
    ['rail', 'path', { d: 'M104 10L92 8L78 79L80 150H96L150 234H170' }],
    ['rail', 'path', { d: 'M287 10L299 8L313 79L311 150H295L241 234H221' }],
    ['bar', 'path', { d: 'M79 118H14M312 118H377' }],
    ['plate', 'rect', { x: 60, y: 78, width: 16, height: 80, rx: 6 }],
    ['plate', 'rect', { x: 40, y: 85, width: 16, height: 66, rx: 6 }],
    ['plate', 'rect', { x: 20, y: 92, width: 16, height: 52, rx: 6 }],
    ['plate', 'rect', { x: 315, y: 78, width: 16, height: 80, rx: 6 }],
    ['plate', 'rect', { x: 335, y: 85, width: 16, height: 66, rx: 6 }],
    ['plate', 'rect', { x: 355, y: 92, width: 16, height: 52, rx: 6 }],
    ['soft', 'circle', { cx: 14, cy: 118, r: 6 }],
    ['soft', 'circle', { cx: 377, cy: 118, r: 6 }],
    ['pad', 'rect', { x: 114.5, y: 30, width: 162, height: 100, rx: 45 }],
    ['pad', 'rect', { x: 129.7, y: 137, width: 131.6, height: 68, rx: 32 }],
    ['frame', 'rect', { x: 170, y: 221, width: 51, height: 27, rx: 5 }]] },
  // #34 Plate-loaded leg extension
  plateLegExtension: { size: [292, 258], u: 2.75, parts: [
    ['bar', 'path', { d: 'M179 52H282' }],
    ['plate', 'rect', { x: 210, y: 4, width: 20, height: 96, rx: 6 }],
    ['plate', 'rect', { x: 234, y: 12, width: 20, height: 80, rx: 6 }],
    ['plate', 'rect', { x: 258, y: 22, width: 20, height: 60, rx: 6 }],
    ['soft', 'circle', { cx: 284, cy: 52, r: 6 }],
    ['roller', 'rect', { x: 48, y: 33, width: 131, height: 37, rx: 18 }],
    ['pad', 'rect', { x: 32, y: 91, width: 162, height: 92, rx: 40 }],
    ['pad', 'rect', { x: 48, y: 190, width: 131, height: 62, rx: 28 }],
    ['bar', 'path', { d: 'M17 102V172M209 102V172' }]] },
  // #35 Plate-loaded shoulder press
  plateShoulderPress: { size: [391, 232], u: 3.56, parts: [
    ['rail', 'path', { d: 'M93 56H75V165L125 199L145 210H169.5' }],
    ['rail', 'path', { d: 'M298 56H316V165L266 199L246 210H221.5' }],
    ['bar', 'path', { d: 'M75 137H8M316 137H383' }],
    ['plate', 'rect', { x: 54, y: 97, width: 16, height: 80, rx: 6 }],
    ['plate', 'rect', { x: 34, y: 104, width: 16, height: 66, rx: 6 }],
    ['plate', 'rect', { x: 14, y: 111, width: 16, height: 52, rx: 6 }],
    ['plate', 'rect', { x: 321, y: 97, width: 16, height: 80, rx: 6 }],
    ['plate', 'rect', { x: 341, y: 104, width: 16, height: 66, rx: 6 }],
    ['plate', 'rect', { x: 361, y: 111, width: 16, height: 52, rx: 6 }],
    ['soft', 'circle', { cx: 8, cy: 137, r: 6 }],
    ['soft', 'circle', { cx: 383, cy: 137, r: 6 }],
    ['pad', 'rect', { x: 114.5, y: 4, width: 162, height: 103, rx: 46 }],
    ['pad', 'rect', { x: 130, y: 109, width: 131, height: 70, rx: 32 }],
    ['frame', 'rect', { x: 169.5, y: 196, width: 52, height: 28, rx: 5 }]] },
  // #36 Plate-loaded upper chest press
  plateUpperChestPress: { size: [391, 252], u: 2.75, parts: [
    ['rail', 'path', { d: 'M128 4L112 2L80 70L80 150H96L150 234H170' }],
    ['rail', 'path', { d: 'M263 4L279 2L311 70L311 150H295L241 234H221' }],
    ['bar', 'path', { d: 'M79 118H14M312 118H377' }],
    ['plate', 'rect', { x: 60, y: 78, width: 16, height: 80, rx: 6 }],
    ['plate', 'rect', { x: 40, y: 85, width: 16, height: 66, rx: 6 }],
    ['plate', 'rect', { x: 20, y: 92, width: 16, height: 52, rx: 6 }],
    ['plate', 'rect', { x: 315, y: 78, width: 16, height: 80, rx: 6 }],
    ['plate', 'rect', { x: 335, y: 85, width: 16, height: 66, rx: 6 }],
    ['plate', 'rect', { x: 355, y: 92, width: 16, height: 52, rx: 6 }],
    ['soft', 'circle', { cx: 14, cy: 118, r: 6 }],
    ['soft', 'circle', { cx: 377, cy: 118, r: 6 }],
    ['pad', 'rect', { x: 119.5, y: 30, width: 152, height: 88, rx: 42 }],
    ['pad', 'rect', { x: 124.7, y: 122, width: 141.6, height: 84, rx: 34 }],
    ['frame', 'rect', { x: 170, y: 221, width: 51, height: 27, rx: 5 }]] },
  // #37 Plate-loaded low row
  plateLowRow: { size: [391, 335], u: 2.75, parts: [
    ['rail', 'path', { d: 'M156 25H47L80 172' }],
    ['rail', 'path', { d: 'M235 25H344L311 172' }],
    ['rail', 'path', { d: 'M118 115L86 150' }],
    ['rail', 'path', { d: 'M273 115L305 150' }],
    ['rail', 'path', { d: 'M118 115L167 107', strokeWidth: 19 }],
    ['rail', 'path', { d: 'M273 115L224 107', strokeWidth: 19 }],
    ['bar', 'path', { d: 'M91 190H8M300 190H383' }],
    ['plate', 'rect', { x: 71, y: 136.5, width: 16, height: 107, rx: 6 }],
    ['plate', 'rect', { x: 51, y: 145.5, width: 16, height: 89, rx: 6 }],
    ['plate', 'rect', { x: 31, y: 154.5, width: 16, height: 71, rx: 6 }],
    ['plate', 'rect', { x: 304, y: 136.5, width: 16, height: 107, rx: 6 }],
    ['plate', 'rect', { x: 324, y: 145.5, width: 16, height: 89, rx: 6 }],
    ['plate', 'rect', { x: 344, y: 154.5, width: 16, height: 71, rx: 6 }],
    ['soft', 'circle', { cx: 8, cy: 190, r: 6 }],
    ['soft', 'circle', { cx: 383, cy: 190, r: 6 }],
    ['pad', 'rect', { x: 156, y: 4, width: 79, height: 43, rx: 10 }],
    ['pad', 'rect', { x: 144, y: 156, width: 103, height: 41, rx: 18 }],
    ['pad', 'rect', { x: 114.5, y: 214, width: 162, height: 116, rx: 45 }]] },
  // #26 Kettlebell rack
  kettlebellRack: { size: [60, 160], u: 1, parts: [
    ['frame', 'rect', { x: 4, y: 4, width: 52, height: 152, rx: 6 }],
    ['pad', 'circle', { cx: 30, cy: 16, r: 6 }],
    ['bar', 'path', { d: 'M25.8 12.4Q30 5.8 34.2 12.4' }],
    ['pad', 'circle', { cx: 30, cy: 38, r: 7 }],
    ['bar', 'path', { d: 'M25.1 33.8Q30 26.1 34.9 33.8' }],
    ['pad', 'circle', { cx: 30, cy: 62, r: 8 }],
    ['bar', 'path', { d: 'M24.4 57.2Q30 48.4 35.6 57.2' }],
    ['pad', 'circle', { cx: 30, cy: 88, r: 9 }],
    ['bar', 'path', { d: 'M23.7 82.6Q30 72.7 36.3 82.6' }],
    ['pad', 'circle', { cx: 30, cy: 116, r: 10 }],
    ['bar', 'path', { d: 'M23 110Q30 99 37 110' }],
    ['pad', 'circle', { cx: 30, cy: 144, r: 11 }],
    ['bar', 'path', { d: 'M22.3 137.4Q30 125.3 37.7 137.4' }]] },
  // #27 Plyo box
  plyoBox: { size: [61, 76], u: 1, parts: [
    ['pad', 'rect', { x: 3, y: 3, width: 55, height: 70, rx: 4 }],
    ['step', 'path', { d: 'M3 3L13 13M58 3L48 13M3 73L13 63M58 73L48 63M13 13H48V63H13Z' }]] },
  // #38 Sprint lane
  sprintLane: { size: [80, 500], u: 0.5, parts: [
    ['pad', 'rect', { x: 0, y: 0, width: 80, height: 500, rx: 6 }],
    ['bar', 'path', { d: 'M6 4H74M6 496H74' }],
    ['mark', 'path', { d: 'M4 4H22M58 4H76M4 53.2H22M58 53.2H76M4 102.4H22M58 102.4H76M4 151.6H22M58 151.6H76M4 200.8H22M58 200.8H76M4 250H22M58 250H76M4 299.2H22M58 299.2H76M4 348.4H22M58 348.4H76M4 397.6H22M58 397.6H76M4 446.8H22M58 446.8H76M4 496H22M58 496H76' }],
    ['ink', 'text', { x: 40, y: 24, textAnchor: 'middle', fontSize: 14, fontWeight: 800, fontFamily: 'Inter, system-ui, sans-serif' }, '0'],
    ['ink', 'text', { x: 40, y: 58.2, textAnchor: 'middle', fontSize: 14, fontWeight: 800, fontFamily: 'Inter, system-ui, sans-serif' }, '1'],
    ['ink', 'text', { x: 40, y: 107.4, textAnchor: 'middle', fontSize: 14, fontWeight: 800, fontFamily: 'Inter, system-ui, sans-serif' }, '2'],
    ['ink', 'text', { x: 40, y: 156.6, textAnchor: 'middle', fontSize: 14, fontWeight: 800, fontFamily: 'Inter, system-ui, sans-serif' }, '3'],
    ['ink', 'text', { x: 40, y: 205.8, textAnchor: 'middle', fontSize: 14, fontWeight: 800, fontFamily: 'Inter, system-ui, sans-serif' }, '4'],
    ['ink', 'text', { x: 40, y: 255, textAnchor: 'middle', fontSize: 14, fontWeight: 800, fontFamily: 'Inter, system-ui, sans-serif' }, '5'],
    ['ink', 'text', { x: 40, y: 304.2, textAnchor: 'middle', fontSize: 14, fontWeight: 800, fontFamily: 'Inter, system-ui, sans-serif' }, '6'],
    ['ink', 'text', { x: 40, y: 353.4, textAnchor: 'middle', fontSize: 14, fontWeight: 800, fontFamily: 'Inter, system-ui, sans-serif' }, '7'],
    ['ink', 'text', { x: 40, y: 402.6, textAnchor: 'middle', fontSize: 14, fontWeight: 800, fontFamily: 'Inter, system-ui, sans-serif' }, '8'],
    ['ink', 'text', { x: 40, y: 451.8, textAnchor: 'middle', fontSize: 14, fontWeight: 800, fontFamily: 'Inter, system-ui, sans-serif' }, '9'],
    ['ink', 'text', { x: 40, y: 486, textAnchor: 'middle', fontSize: 14, fontWeight: 800, fontFamily: 'Inter, system-ui, sans-serif' }, '10']] },
};

/**
 * A dumbbell rack holds as many pairs as its length fits, rather than a fixed
 * six stretched to whatever length it was placed at. `length` is in the
 * rack's own units, 80 across.
 */
export const dumbbellRack = (length: number): Drawing => {
  const L = Math.max(120, length);
  const room = L - 28 - 26;
  const pairs = Math.max(2, Math.floor(room / 39) + 1);
  const gap = room / (pairs - 1);
  const parts: Part[] = [['frame', 'rect', { x: 4, y: 4, width: 72, height: L - 8, rx: 8 }]];
  for (let i = 0; i < pairs; i++) {
    const y = 14 + i * gap;
    parts.push(['pad', 'rect', { x: 12, y, width: 16, height: 26, rx: 4 }]);
    parts.push(['pad', 'rect', { x: 52, y, width: 16, height: 26, rx: 4 }]);
    parts.push(['bar', 'path', { d: `M28 ${y + 13}H52` }]);
  }
  return { size: [80, L], u: 1, parts };
};

// ---- Colour: three shades of the zone's colour ----

export interface Palette { solid: string; frame: string; edge: string; soft: string; light: string }

const hexToHsl = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
};

/**
 * The machine's shades from its zone's colour: a mid shade for pads, a darker
 * one for the frame, near-black edges and a pale one for bars. Weak colours
 * are brought up so the shades stay apart; a grey zone stays grey.
 */
export const paletteOf = (zoneColor: string | undefined): Palette => {
  let hex = (zoneColor || '').trim();
  if (/^#[0-9a-f]{3}$/i.test(hex)) hex = '#' + hex.slice(1).split('').map(c => c + c).join('');
  if (!/^#[0-9a-f]{6}$/i.test(hex)) hex = '#64748b';
  const [h, s0] = hexToHsl(hex);
  const s = s0 < 25 ? s0 : Math.max(s0, 60);
  const hsl = (sat: number, l: number) => `hsl(${h.toFixed(0)} ${sat.toFixed(0)}% ${l}%)`;
  return { solid: hsl(s, 58), frame: hsl(s, 42), edge: hsl(s, 15), soft: hsl(Math.min(s, 95), 86), light: hsl(s, 72) };
};

const line = (color: string, width: number) =>
  ({ fill: 'none', stroke: color, strokeWidth: width, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

/** How a part of each role is painted; `u` keeps line widths in centimetres. */
export const lookOf = (role: Role, p: Palette, u: number) => {
  switch (role) {
    case 'pad': case 'plate': return { fill: p.solid, stroke: p.edge, strokeWidth: 2.2 * u };
    case 'frame': return { fill: p.frame, stroke: p.edge, strokeWidth: 2.2 * u };
    case 'soft': return { fill: p.soft };
    case 'rail': return line(p.frame, 4.2 * u);
    case 'bar': return line(p.soft, 4.6 * u);
    case 'deck': return { fill: p.edge };
    case 'step': return { ...line(p.soft, 1.4 * u), strokeOpacity: 0.5 };
    case 'roller': return { fill: p.light, stroke: p.edge, strokeWidth: 2.2 * u };
    case 'ink': return { fill: p.edge, stroke: 'none' };
    case 'mark': return line(p.edge, 4.2 * u);
  }
};
