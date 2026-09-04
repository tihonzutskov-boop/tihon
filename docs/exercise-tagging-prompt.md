# GYDE exercise tagging prompt

Copy everything between the two `====` lines into Claude, then list your
exercise names at the bottom. The output comes back in the same order as the
fields in the Edit modal, so you can click straight down the form.

====

Tag exercises for a gym app. A rules engine reads these tags — it can only use
the exact values listed, so never invent one.

## The seven fields

**1. Pattern** — one only. Ask: *which joint drives the movement?*

Multi-joint (compound movements):
`horizontal_push` bench press, push-up, chest press, dip ·
`horizontal_pull` any row ·
`vertical_push` overhead / shoulder press ·
`vertical_pull` pull-up, chin-up, lat pulldown ·
`squat` squat, goblet squat, leg press ·
`hinge` deadlift, RDL, hip thrust, good morning, swing ·
`lunge` lunge, split squat, step-up ·
`carry` farmer's carry, suitcase carry

Single-joint (isolation):
`shoulder_abduction` lateral / front raise, rear delt fly ·
`horizontal_adduction` chest fly, pec deck ·
`elbow_flexion` any biceps curl ·
`elbow_extension` pushdown, overhead extension, kickback ·
`knee_extension` leg extension ·
`knee_flexion` leg / hamstring curl ·
`hip_extension` glute kickback, glute bridge, cable pull-through ·
`hip_adduction` adductor machine, cable hip adduction ·
`hip_abduction` abductor machine, banded lateral walk ·
`calf_raise` calf raise

Other:
`core` plank, dead bug, crunch, cable chop ·
`conditioning` treadmill, bike, rower, sprints ·
`mobility` stretching, foam rolling, band pull-apart

Tie-breakers:
- Compound beats isolation. Close-grip bench press is `horizontal_push`, not
  `elbow_extension`.
- "Leg curl" is `knee_flexion`. Only arm curls are `elbow_flexion`.
- Goblet squat is `squat` — the arms only hold the weight.
- A bare "kickback" is a triceps kickback (`elbow_extension`). A *glute*
  kickback is `hip_extension`. If the name doesn't say which, ask.
- Loaded hip hinges (deadlift, RDL, hip thrust, good morning) are `hinge`.
  Single-joint glute work (kickback, bridge, pull-through) is
  `hip_extension`.

**2. Type** — one only:
`compound` `isolation` `cardio` `mobility` `warmup` `cooldown`

More than one joint moves → `compound`. One joint → `isolation`.
Pull-ups and lat pulldowns are `compound`. Pushdowns and extensions are
`isolation`.

**3. Experience** — one only: `Beginner` `Intermediate` `Advanced`

Hard filter: an `Advanced` exercise is never given to a beginner. Default to
`Beginner`. Use `Intermediate` only for real technique (barbell back squat,
conventional deadlift, dips), `Advanced` only for skill lifts (snatch, clean,
muscle-up, pistol squat).

**4. Primary muscles** and **5. Secondary muscles**

Specific heads only — there is no "Back", "Shoulders", "Arms", "Legs",
"Core" or "Full body":

`Chest` `Upper chest` `Lats` `Upper back` `Lower back` `Front delts`
`Side delts` `Rear delts` `Biceps` `Triceps` `Forearms` `Quads` `Hamstrings`
`Glutes` `Calves` `Adductors` `Abductors` `Abs` `Obliques`

- Primary = what it's for (1–2 heads). Secondary = also worked (0–3 heads).
- Name the head, not the region: lat pulldown is `Lats`; lateral raise is
  `Side delts`; front raise is `Front delts`; rear delt fly is `Rear delts`.
- Row = `Upper back` + `Lats`. Deadlift = `Lower back`, `Glutes`, `Hamstrings`.
  Squat = `Quads` + `Glutes`, never just one.

**6. Stress** — the field people get wrong. Tag as little as possible.

`Back` `Knees` `Shoulders` `Neck` `Wrists` `Hips` `Ankles` `Elbows` `Chest`
`Groin` `Hamstrings` `Achilles`

This is a hard exclusion: a client reporting that area loses every exercise
tagged with it. Over-tagging leaves people with almost no plan.

The test is NOT "is this joint involved?" It is:

> Would a coach swap this exercise out for someone with pain there?

If no, leave it off. **Most exercises need 0–2 tags. Many need none — answer
`none`.**

- Right: goblet squat → `Knees`. Bench press → `Shoulders`. Pushdown →
  `Elbows`. Deadlift → `Back`. Overhead press → `Shoulders`.
- Wrong: a row tagged `Elbows` because the elbow bends.
- Wrong: a bench press tagged `Chest` — this field is aggravation risk, not
  muscles worked.
- Wrong: a squat tagged `Achilles` because the ankle flexes.
- Never tag every joint the movement uses.

**7. Equipment** — what the exercise cannot be done without.

Pick only from this gym's actual equipment library:

**Accessories** — `3-in-1  Plyo Box` · `Adjustable Bench` · `Resistance Bands & Battle Ropes`
**Benches & Racks** — `Bench press`
**Cables** — `Cable Station` · `Lat Pulldown`
**Cardio** — `Air Resistance Assault Bike` · `Air Rower` · `RoadBike`
**Free Weights** — `Dumbbell rack` · `Kettlebells` · `Power Rack`
**Functional & Floor** — `Functional Training Rig` · `Open Floor / Mat Area`
**Machines** — `45° Plate-Loaded Leg Press` · `Adductor machine` · `Bike` · `Chest Press Machine` · `Delts machine` · `Elliptical machine` · `Leg Curll` · `Leg Extension` · `Leg Press` · `Lower back machine` · `Pectoral Machine` · `Prone Leg Curl` · `Shoulder Press machine` · `Stairmaster` · `Treadmill` · `Vertical Traction machine`
**Plaetd machine** — `Chest press machine` · `Glute Kickback` · `Leg Press` · `Low Row` · `Pull Down` · `Row` · `Seated Dip`

Rules that matter more than the list:

- **Required equipment is AND-ed.** An exercise is only offered to someone
  whose gym has *every* item you list. One extra item makes it unavailable at
  gyms that could genuinely do it, so list the **minimum**, not everything you
  could plausibly use.
- Usually that is **exactly one** item. A dumbbell curl needs
  `Dumbbell rack` — not a bench, not a mat.
- List two only when both are genuinely needed at once: a dumbbell bench press
  is `Dumbbell rack` + `Adjustable Bench`.
- Bodyweight work needs **none** — a push-up, plank or air squat should be
  `none` so it stays available everywhere.
- Match the name **exactly** as written above. If nothing matches, say
  `none — needs a new item` rather than inventing a name.
- Where two entries look like the same machine, pick the one whose category
  matches the exercise and flag it, rather than guessing.

## Before you answer — check each of these

Run this list against every exercise before returning it. These are the
mistakes that actually happen:

1. **One value per single-select.** Pattern, Type and Experience take exactly
   one. Never two.
2. **Never a region name in muscles.** If you wrote `Back`, `Shoulders`,
   `Arms`, `Legs`, `Core` or `Full body`, replace it — those are not valid
   values. `Back` → `Lats` or `Upper back`. `Shoulders` → `Front delts`,
   `Side delts` or `Rear delts`. `Core` → `Abs`.
3. **Replace, never both.** Give the specific head only — not `Back, Lats`
   and not `Shoulders, Side delts`.
4. **Experience is never blank.** Every exercise gets one, default
   `Beginner`.
5. **Compound vs isolation:** pull-up, chin-up, lat pulldown, row, dip and
   leg press are `compound`. Curl, pushdown, extension, raise, fly, leg
   extension, leg curl and calf raise are `isolation`.
6. **Stress: count your tags.** More than two on one exercise almost always
   means you tagged joints that merely participate. A bench press is
   `Shoulders` — not `Shoulders, Elbows, Chest`. A pull-up is `Shoulders` —
   not `Wrists, Back, Shoulders`. A leg press is `Knees` — not
   `Knees, Back, Hips`.
7. **Secondary muscles are optional.** Don't pad them. A pushdown's secondary
   is `none`.
8. **Don't tag the muscles worked as stress.** Stress means "would a coach
   avoid this for someone with pain there", not "what does it work".
9. **Equipment: fewest items possible.** Every item you add removes the
   exercise from more gyms. One item is the norm, two is uncommon, three is
   almost always wrong. Bodyweight is `none`.

## Output

One block per exercise, exactly these seven fields in this order, nothing else.
No preamble, no summary, no notes.

```
Bench Press
Pattern:    horizontal_push
Type:       compound
Experience: Beginner
Primary:    Chest
Secondary:  Triceps, Front delts
Stress:     Shoulders
Equipment:  Dumbbell rack, Adjustable Bench
```

```
Triceps Pushdown
Pattern:    elbow_extension
Type:       isolation
Experience: Beginner
Primary:    Triceps
Secondary:  none
Stress:     Elbows
Equipment:  Cable Station
```

```
Pull Up
Pattern:    vertical_pull
Type:       compound
Experience: Beginner
Primary:    Lats
Secondary:  Biceps, Upper back
Stress:     Shoulders
Equipment:  Functional Training Rig
```

If a name is too vague to tag (just "Press", "Curl", "Machine"), don't guess —
list it under "Need more detail" and say which variation you need.

Exercises to tag:

====

## Applying the result

**Exercise Library → find the exercise → Edit.** The blocks come back in modal
order, so work top to bottom: Movement pattern, Type, Minimum experience,
Primary muscles, Secondary muscles, Stresses these areas. Make sure **Enabled**
is on before saving.

Two things worth doing in the same pass:

- Also fix the free-text **Target Muscle** and **Category** fields above. They
  feed the auto-derivation, so a stale "Isolation (Hypertrophy)" on a pull-up
  will re-suggest the wrong Type next time you use bulk tagging.
- An exercise missing a movement pattern or type is invisible to the
  generator, no matter what else is filled in.
