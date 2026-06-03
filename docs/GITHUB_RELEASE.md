---
## What's new in v1.6.0

### 🏷️ Custom status tags
The fixed pending → seen → summarized → studied cycle is gone. Each semester now defines its own **reading tags** and **task tags**, grouped into *Pending* (don't count toward progress) and *Done* (count toward progress) sections. Clicking a status badge opens a dropdown so you can assign any tag. Protected tags ("pending" and "studied") keep their role but can be recolored. **Legacy semesters are migrated automatically** — no manual changes needed.

### 📚 Study Mode
A new toggle in the header narrows course progress to items tagged "studied" only. Useful when preparing for exams and you only want to see what you've fully studied. A green **Studied** shortcut appears in the status dropdown while the mode is on.

### 🎯 Focus mode
Click any course name in the dashboard to isolate that course's column: it centres, widens, and the other columns dim. Click again (or press Esc) to exit.

### 🗂️ All Courses view improvements
- Each course column now has **collapsible week sections** (chevron toggle); the current week is auto-expanded, others start collapsed.
- Three header buttons let you **expand all**, **collapse all**, or **jump to the current week** across both views.
- Columns are a **uniform 300 px wide** regardless of course name length. Long names are truncated with an ellipsis and show the full name on hover.

### ↕️ Sort control
Order courses by **progress ↓/↑**, **alphabetically A–Z / Z–A**, or by **week ↑/↓**. The sort is non-destructive (never rewrites the file) and persists across restarts.

### ✨ Header & UI cleanup
- Native macOS title-bar text hidden — only the traffic-light buttons remain.
- Small rounded app logo added next to the "Lectio" wordmark.
- Theme selector moved from the header into **Settings** as a Light / Dark / Auto segmented control.
- Edit and Delete semester actions are now a labelled pair attached to the semester selector.
- All header controls share a uniform 32 px height.
- The **＋ New** button replaces the old separate "+ Add" and "+ New Semester" buttons. The semester modal gains a **Reading / Task** tab for quickly adding items to the current semester without leaving the modal.

---

**Full changelog:** [`docs/RELEASE_NOTES.md`](docs/RELEASE_NOTES.md)

**macOS:** download `Lectio-arm64.dmg` below → drag to Applications.  
**Windows:** download `Lectio-Setup.exe` below → Next → Next → Install.  
**Homebrew:** `brew tap masprime77/tap && brew install --cask lectio`

> First launch on macOS: right-click → Open (Gatekeeper), or run `xattr -cr /Applications/Lectio.app` in Terminal.  
> First launch on Windows: click **More info → Run anyway** (SmartScreen).
---

<!--
AFTER THE PR IS MERGED — what to run

After merging the PR into main:

  git checkout main
  git pull origin main
  git tag v1.6.0
  git push origin v1.6.0

The release.yml workflow will then run CI and, if it passes, build and
publish the macOS (.dmg + .zip + latest-mac.yml) and Windows (.exe + .zip +
latest.yml) assets to a new GitHub Release for the v1.6.0 tag. Once the
draft release appears in GitHub, paste the content of docs/GITHUB_RELEASE.md
into the description field and publish it to make the download links live.

After publishing, update the Homebrew cask:

  homebrew/sync-tap.sh
-->
