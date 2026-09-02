# GYDE exercise tagging prompt

Paste everything between the lines below into Claude, then add your exercise
names at the end. Keep the whole block — the rules matter as much as the lists.

---

You are tagging exercises for a gym app's automatic workout plan generator.
The generator is a deterministic rules engine, not an AI — it can only use the
exact values below. Any value outside these lists breaks it.

For each exercise name I give you, return one row of a markdown table with
these columns: Exercise, Movement pattern, Type, Min experience, Primary
muscles, Secondary muscles, Joint stress.

## Movement pattern (pick exactly ONE)

The pattern is the *motion*, independent of equipment. It is a hard filter:
the generator asks for "a horizontal push" and only exercises with that exact
pattern can fill the slot.

| Value | Meaning | Examples |
|---|---|---|
| `horizontal_push` | Push away from the chest, horizontally | Bench press, push-up, chest press, dip |
| `horizontal_pull` | Pull toward the torso, horizontally | Barbell row, cable row, dumbbell row |
| `vertical_push` | Press overhead | Overhead press, shoulder press, pike push-up |
| `vertical_pull` | Pull down from overhead | Pull-up, chin-up, lat pulldown |
| `squat` | Knees and hips bend together | Back squat, front squat, goblet squat, leg press |
| `hinge` | Hips travel back then forward, knees mostly still | Deadlift, Romanian deadlift, hip thrust, good morning, kettlebell swing |
| `lunge` | Single-leg knee and hip movement | Lunge, Bulgarian split squat, step-up |
| `carry` | Load carried while walking or held | Farmer's carry, suitcase carry, waiter's walk |
| `shoulder_abduction` | Arm raises away from the body | Lateral raise, front raise, rear delt fly |
| `horizontal_adduction` | Arms close across the chest | Chest fly, pec deck, cable crossover |
| `elbow_flexion` | Elbow bends, upper arm still | Biceps curl, hammer curl, preacher curl |
| `elbow_extension` | Elbow straightens, upper arm still | Triceps pushdown, overhead extension, kickback |
| `knee_extension` | Knee straightens against load | Leg extension machine |
| `knee_flexion` | Knee bends against load | Lying leg curl, seated leg curl |
| `calf_raise` | Ankle extends, heel lifts | Standing or seated calf raise |
| `core` | Trunk resists or drives the motion | Plank, dead bug, hollow hold, cable chop, crunch |
| `conditioning` | Sustained cyclical cardio effort | Treadmill, rowing machine, assault bike, sprints |
| `mobility` | Joint moved through range, little or no load | Dynamic stretch, foam rolling, band pull-apart |

Rules:
- A compound lift always wins over an isolation reading. A close-grip bench
  press is `horizontal_push`, not `elbow_extension`, even though it hits
  triceps hard.
- A "leg curl" is `knee_flexion`, not `elbow_flexion` — it is a curl by name
  only.
- Multi-joint means naming the *primary* joint action. A goblet squat is
  `squat` even though the arms hold the weight.

## Type (pick exactly ONE)

`compound` · `isolation` · `cardio` · `mobility` · `warmup` · `cooldown`

- `compound` = more than one joint moves under load (squat, row, pull-up,
  bench press, overhead press, lunge, deadlift).
- `isolation` = one joint moves (curl, pushdown, lateral raise, leg extension,
  leg curl, calf raise, chest fly).
- `cardio` = sustained machine or running work.
- Get this right: pull-ups and lat pulldowns are `compound`; triceps pushdowns
  and extensions are `isolation`.

## Min experience (pick exactly ONE)

`Beginner` · `Intermediate` · `Advanced`

This is a hard filter — an exercise marked `Advanced` is never given to a
beginner. Default to `Beginner` for anything a newcomer can safely do with
brief instruction. Reserve `Intermediate` for exercises needing real technique
(barbell back squat, conventional deadlift, dips) and `Advanced` for skill
lifts (snatch, clean and jerk, muscle-up, pistol squat).

## Primary and secondary muscles

Choose only from these specific heads — there is no plain "Back",
"Shoulders", "Arms", "Legs", "Core" or "Full body":

`Chest` · `Upper chest` · `Lats` · `Upper back` · `Lower back` ·
`Front delts` · `Side delts` · `Rear delts` · `Biceps` · `Triceps` ·
`Forearms` · `Quads` · `Hamstrings` · `Glutes` · `Calves` · `Adductors` ·
`Abductors` · `Abs` · `Obliques`

- Primary = what the exercise is *for*, usually 1–2 heads.
- Secondary = meaningfully worked but not the point, usually 1–3 heads.
- Name the actual head, not the region. A lat pulldown is `Lats`, not "Back".
  A lateral raise is `Side delts`, a front raise `Front delts`, a rear delt
  fly `Rear delts` — never all three, and never "Shoulders".
- A row is usually `Upper back` plus `Lats`; a deadlift is `Lower back`,
  `Glutes`, `Hamstrings`.
- A squat's primary is `Quads, Glutes` — do not list only one.
- These drive weekly balance checks, so be accurate rather than generous.

## Joint stress — TAG SPARINGLY, THIS IS THE ONE PEOPLE GET WRONG

Choose only from: `Back` · `Knees` · `Shoulders` · `Neck` · `Wrists` · `Hips` ·
`Ankles` · `Elbows` · `Chest` · `Groin` · `Hamstrings` · `Achilles`

This is a hard exclusion. If a client reports an injured area, EVERY exercise
tagged with that area is removed from their plan entirely.

The test is NOT "does this area participate in the movement?" — it is:

> **Would a coach actually swap this exercise out for someone complaining of
> pain in that area?**

If the answer is no, leave the tag off.

Most exercises need **zero to two** tags. Never tag every joint involved.

- Correct: goblet squat → `Knees, Back`. Bench press → `Shoulders`. Triceps
  pushdown → `Elbows`. Deadlift → `Back`. Overhead press → `Shoulders`.
- Wrong: tagging a dumbbell row with `Elbows` because the elbow bends.
- Wrong: tagging a bench press with `Chest` because it works the chest —
  joint stress means *aggravation risk*, not muscles trained.
- Wrong: tagging a goblet squat with `Achilles` because the ankle flexes.

Return `—` when nothing genuinely qualifies. An empty joint stress list is
normal and correct for many exercises.

## Output format

Return only the markdown table, no commentary. Use the exact snake_case values
above for movement pattern and type. Example:

| Exercise | Movement pattern | Type | Min experience | Primary muscles | Secondary muscles | Joint stress |
|---|---|---|---|---|---|---|
| Goblet Squat | `squat` | `compound` | `Beginner` | Quads, Glutes | Abs | Knees, Back |
| Triceps Pushdown | `elbow_extension` | `isolation` | `Beginner` | Triceps | — | Elbows |
| Dumbbell Row | `horizontal_pull` | `compound` | `Beginner` | Upper back, Lats | Biceps | Back |

If an exercise name is ambiguous (for example "Press" or "Curl" with no other
words), say so and ask which variation is meant rather than guessing.

Here are the exercises to tag:

---

## How to use the result

For each row, in the GYDE admin: **Exercise Library → find the exercise →
Edit**, then set Movement pattern, Type, Min experience, Primary/Secondary
muscles and Joint stress to match, and make sure **Enabled** is on.

The generator ignores any exercise that isn't enabled or is missing a movement
pattern or type — those two are required for it to be selectable at all.
