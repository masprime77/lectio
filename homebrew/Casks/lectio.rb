cask "lectio" do
  version "1.8.1"
  sha256 "8ebae3b296abde873da262bd72b5fb4ed5b09124c278357c3597a57bbf6700ba"

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
