# Legal documents

`impressum.{de,en}.html` and `datenschutzerklaerung.{de,en}.html` are the
finalized Impressum (legal notice) and Datenschutzerklärung (privacy policy),
generated via eRecht24 and Datenschutz-Generator.de and reviewed by the
maintainer. Each file is an HTML **fragment** (no `<html>`/`<body>` wrapper) —
platforms wrap it in their own minimal styled shell before displaying it.

- **Desktop** (`@lectio/desktop`) reads these files directly at runtime: from
  this folder in dev, or from a packaged copy under the app's resources (see
  the `extraResources` entry in `packages/desktop/package.json`).
- **Mobile** (`@lectio/mobile`) bundles a **copy** of these same four files at
  `packages/mobile/assets/legal/` so they're available fully offline. That
  copy must be byte-identical to this folder — if the content here ever
  changes, re-copy the files into `packages/mobile/assets/legal/` as part of
  the same change.

Only the English (`.en.html`) variants are currently wired into the apps —
neither app has a language toggle yet. The German (`.de.html`) originals stay
here for when one is added.
