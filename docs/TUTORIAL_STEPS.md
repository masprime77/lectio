# Tutorial Steps

Lectio shows an interactive tour on first launch, and whenever the user triggers it from **Settings → Start tour**.

## How steps work

Each step is an entry in the `TUTORIAL_STEPS` array in `app.js`. Fields:

| Field            | Type                   | Description                                                        |
|------------------|------------------------|--------------------------------------------------------------------|
| `id`             | `string`               | Unique key (not shown to users, used for future lookup)            |
| `title`          | `string`               | Short heading in the tooltip                                       |
| `description`    | `string`               | Plain text explanation (no HTML)                                   |
| `targetSelector` | `string \| null`       | CSS selector for the element to spotlight; `null` = no spotlight   |
| `setup`          | `async function \| null` | Run before the step is shown; must be idempotent; receives no args |

## Adding a step for a new feature

1. Open `app.js` and find the `TUTORIAL_STEPS` array.
2. Append a new object at the appropriate position (usually second-to-last, before the "You're all set" step).
3. Set `targetSelector` to the CSS selector or `id` of the UI element you want to highlight.
4. If the feature requires a specific app state (e.g., a particular view or semester loaded), implement it in `setup`.

No other files need to change for a new step.

## Resetting the tutorial (for testing)

Run this in the DevTools console (`Cmd+Option+I` or `--dev-tools` flag):

```js
localStorage.removeItem('tutorialSeen');
location.reload();
```

The tour will auto-launch on the next load.

## First-run logic

`init()` calls `startTutorial()` with a 300ms delay if `localStorage.tutorialSeen` is not `'true'`. The flag is set to `'true'` when the user clicks Finish or Skip. Closing via Escape also sets it.
