# Homebrew Cask for Semester Planner (recommended way to install the GUI app).
#
# This is a TEMPLATE. After cutting a release, fill `version` and `sha256` —
# the easiest way is to run:  homebrew/update-cask.sh <version>
# (it downloads the release .dmg, computes the sha256, and rewrites both lines).
cask "semester-planner" do
  version "1.0.0"
  sha256 "REPLACE_WITH_SHA256_OF_DMG"

  url "https://github.com/masprime77/semester-planner/releases/download/v#{version}/SemesterPlanner-arm64.dmg",
      verified: "github.com/masprime77/semester-planner/"
  name "Semester Planner"
  desc "Minimal semester planner desktop app"
  homepage "https://github.com/masprime77/semester-planner"

  # The packaged Electron app bundles its own Node runtime, so no extra deps.
  depends_on arch: :arm64

  app "Semester Planner.app"

  caveats <<~EOS
    Semester Planner is currently built for Apple Silicon (arm64) only.

    Your semester data is stored separately from the app and persists across
    updates and uninstalls, at:
      ~/Library/Application Support/Semester Planner/semesters/
  EOS
end
