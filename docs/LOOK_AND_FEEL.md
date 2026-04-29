# Look and Feel Design Standard

This document defines the canonical visual design standards for the Dosh frontend. It exists to prevent ad-hoc colour choices, inconsistent alert treatments, and semantic colour drift across the UI.

## Purpose

- Establish a single source of truth for semantic colour usage
- Define reusable component patterns for alerts, badges, and status surfaces
- Ensure dark-mode treatments remain clean, accessible, and free of muddy palettes
- Provide a reference that future sessions and contributors must consult before introducing new visual patterns

## Scope

- Semantic colour meanings (what each hue communicates)
- Alert and notification surface design
- Badge usage rules
- Dark-mode palette constraints
- Icon pairing conventions

This document does **not** cover:

- Tailwind configuration (see `frontend/tailwind.config.js`)
- Component-level spacing or layout grids
- Animation or motion standards

## Semantic Colour Usage

Each semantic colour must carry exactly one meaning. Reusing a hue for unrelated concepts dilutes its communicative power and trains users to ignore it.

| Tone | Meaning | Example Uses |
|------|---------|--------------|
| **Green (success)** | Positive completion, healthy state, under budget | Setup ready, under-budget actuals, positive balances |
| **Red (error)** | Failure, danger, over budget, destructive action | Save errors, validation failures, over-budget actuals, negative balances |
| **Amber (warning)** | Caution, attention required, time-sensitive | Locked cycles, pending closure, true warnings |
| **Blue / Slate (info)** | Neutral guidance, helpful context, setup hints | Setup assessment guidance, empty states, helper copy |
| **Dosh (brand)** | Primary action, navigation, active state | Buttons, active nav links, primary CTAs |

### Rules

- **Amber must not be used for routine informational guidance.** If the message is "here's what to do next," use the info tone. Reserve amber for states that genuinely warrant caution.
- **Red must not be used for neutral negative numbers.** A negative balance or over-budget line is data, not an error. Use red for the number itself, but not for the surrounding alert surface unless the user needs to take corrective action.
- **Green must not be used for inactive or disabled states.** Green signals success, not neutrality.

## Alert and Notification Surfaces

All alert-style surfaces should use the `AlertBanner` component (see `frontend/src/components/AlertBanner.jsx`). Inline one-off styles are permitted only when the component cannot reasonably be used.

### AlertBanner Tones

| Tone | Light Mode | Dark Mode | Icon |
|------|------------|-----------|------|
| **info** | `border-slate-200 bg-slate-50 text-slate-800` | `border-slate-700 bg-slate-900/50 text-slate-200` | `InformationCircleIcon` |
| **success** | `border-green-200 bg-green-50 text-green-800` | `border-green-800 bg-green-950/20 text-green-300` | `CheckCircleIcon` |
| **warning** | `border-amber-200 bg-amber-50 text-amber-800` | `border-amber-800 bg-amber-950/20 text-amber-300` | `ExclamationTriangleIcon` |
| **error** | `border-red-200 bg-red-50 text-red-700` | `border-red-800 bg-red-950/20 text-red-300` | `XCircleIcon` |

### Dark-Mode Constraints

- **Avoid `amber-950/20` for info surfaces.** On dark backgrounds it renders as muddy brown and feels like a warning even when the intent is neutral guidance.
- **Prefer `slate-900/50` or `slate-800/70` for neutral info backgrounds.** These stay within the cool grey family and do not clash with the app's dark slate base.
- **Borders in dark mode should be subtle.** Use `/{opacity}` (e.g. `/30`, `/40`) to keep borders from becoming glowing neon outlines.
- **Text in dark mode should avoid pure white on saturated backgrounds.** Use the Tailwind `-300` or `-200` text scale for softer contrast.

### Icon Pairing

Every alert surface should lead with a 20×20px icon from `@heroicons/react/24/outline`. The icon must match the tone:

- `InformationCircleIcon` for info
- `CheckCircleIcon` for success
- `ExclamationTriangleIcon` for warning
- `XCircleIcon` for error

Icons provide instant semantic recognition and improve scanability.

## Badge Usage

Badges are compact status indicators. The existing CSS badge classes in `frontend/src/index.css` are the canonical source:

| Class | Use |
|-------|-----|
| `.badge-green` | Ready, complete, healthy |
| `.badge-red` | Error, blocked, failing |
| `.badge-amber` | Needs attention, caution |
| `.badge-blue` | In use, active, informational count |
| `.badge-gray` | Neutral, default, inactive |

Badges must not be used for long sentences. Keep labels to one or two words.

## Setup Assessment Specifics

The setup assessment is **informational guidance**, not a warning. Therefore:

- When `can_generate` is `false`, render the assessment with the **info** tone.
- When `can_generate` is `true`, render the assessment with the **success** tone.
- Blocking issues should be listed as clean bullet items inside the info banner, not as amber warning text.

This rule was introduced to fix the prior design where amber was incorrectly used for routine setup guidance, creating an unnecessarily alarming first-run experience.

## Calendar and Event Surfaces

Calendar events may use tone-aligned colours:

| Event Kind | Light | Dark |
|------------|-------|------|
| Cycle start | `border-sky-200 bg-sky-50` | `border-sky-800 bg-sky-950/20` |
| Income | `border-dosh-200 bg-dosh-50` | `border-dosh-800 bg-dosh-950/20` |
| Expense | `border-slate-200 bg-slate-50` | `border-slate-700 bg-slate-900/40` |

Expense events previously used amber. They have been moved to slate so that amber remains reserved for genuine warning states.

## Migration Notes

- When refactoring existing inline alert styles to `AlertBanner`, remove the old inline Tailwind strings rather than leaving them commented out.
- If a page contains both a warning banner (amber) and an info banner (slate), ensure the warning banner is visually dominant through placement (above the fold) rather than through colour saturation alone.
- Update tests that assert on Tailwind class names only when the test is explicitly verifying design compliance. Prefer asserting on visible text and ARIA roles.

## Related Documents

- [DOCUMENTATION_FRAMEWORK.md](/home/ubuntu/dosh/docs/DOCUMENTATION_FRAMEWORK.md) — documentation governance
- [DOCUMENT_REGISTER.md](/home/ubuntu/dosh/docs/DOCUMENT_REGISTER.md) — document inventory
- [FRONTEND_MODULARISATION_PLAN.md](/home/ubuntu/dosh/docs/plans/FRONTEND_MODULARISATION_PLAN.md) — component organisation
