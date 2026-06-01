cask "semester-planner" do
  version "1.0.3"
  sha256 "5dbc71cd5f7bedd92a465aa4b406c11884b29bdac5f07b9dfd06f817648e91f0"

  url "https://github.com/masprime77/semester-planner/releases/download/v#{version}/Semester-Planner-#{version}-arm64-mac.zip",
      verified: "github.com/masprime77/semester-planner/"
  name "Semester Planner"
  desc "Minimal semester planner desktop app (Electron)"
  homepage "https://github.com/masprime77/semester-planner"

  # Only an arm64 (Apple Silicon) build is published.
  depends_on arch: :arm64

  app "Semester Planner.app"

  # The build is ad-hoc signed (not notarized), so strip the download quarantine
  # on install — otherwise Gatekeeper blocks the first launch.
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "/Applications/Semester Planner.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/Semester Planner",
    "~/Library/Preferences/com.tu-usuario.semester-planner.plist",
  ]
end
