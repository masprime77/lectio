# Homebrew formula template for Semester Planner.
#
# This is a TEMPLATE. Before publishing, replace the three placeholders below:
#   - version : the released version, e.g. "1.0.0"
#   - url     : the URL of the mac .zip asset attached to the GitHub Release
#   - sha256  : the SHA-256 of that .zip (run `shasum -a 256 <file>`)
#
# Note: there is intentionally NO `depends_on "node"` — the packaged Electron
# app bundles its own Node.js runtime.
class SemesterPlanner < Formula
  desc "Minimal semester planner desktop app (Electron)"
  homepage "https://github.com/masprime77/semester-planner"

  version "VERSION_PLACEHOLDER"
  url "URL_PLACEHOLDER"
  sha256 "SHA256_PLACEHOLDER"

  def install
    # The release .zip contains "Semester Planner.app". Copy the bundle into the
    # formula prefix, then expose it in /Applications.
    prefix.install "Semester Planner.app"
    (prefix/"Semester Planner.app").chmod 0755
  end

  def caveats
    <<~EOS
      Semester Planner.app was installed to:
        #{prefix}/Semester Planner.app

      To launch it from Spotlight / Launchpad, link it into /Applications:
        ln -sfn "#{prefix}/Semester Planner.app" "/Applications/Semester Planner.app"

      Your semester data is stored separately from the app and persists across
      updates and uninstalls, at:
        ~/Library/Application Support/Semester Planner/semesters/
    EOS
  end

  test do
    assert_predicate prefix/"Semester Planner.app", :exist?
  end
end
