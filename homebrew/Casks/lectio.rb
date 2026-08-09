cask "lectio" do
  version "1.0.0"
  sha256 "f432f83e8149310a8330157479ce8038c47167a3715508f333a7ef11f869cce5"

  url "https://github.com/masprime77/lectio/releases/download/v#{version}/Lectio-#{version}-arm64-mac.zip",
      verified: "github.com/masprime77/lectio/"
  name "Lectio"
  desc "Minimal desktop app for planning a university semester (Electron)"
  homepage "https://github.com/masprime77/lectio"

  # Only an arm64 (Apple Silicon) build is published.
  depends_on arch: :arm64

  app "Lectio.app"

  # The build is ad-hoc signed (not notarized), so strip the download quarantine
  # on install — otherwise Gatekeeper blocks the first launch.
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "/Applications/Lectio.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/Lectio",
    "~/Library/Preferences/com.masprime77.lectio.plist",
  ]
end
