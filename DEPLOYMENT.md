# Deployment Guide — Virtual Host Manager

How to build, release via GitHub, and distribute via Homebrew Cask.

---

## Overview

```
Developer pushes git tag
  → GitHub Actions builds DMG
  → Uploads to GitHub Releases
  → Updates Homebrew Tap formula automatically

User runs:
  brew tap outscoper/localhost-mapper
  brew install --cask localhost-mapper
```

---

## Part 1: One-Time Setup

### Step 1 — Create the Homebrew Tap Repository

1. Go to [github.com/new](https://github.com/new)
2. Create a **public** repository named exactly: `homebrew-localhost-mapper`
3. Initialize with a `README.md`
4. Inside the repo, create the directory structure:

```
homebrew-localhost-mapper/
└── Casks/
    └── localhost-mapper.rb
```

5. Create `Casks/localhost-mapper.rb` with this initial content (replace `outscoper`):

```ruby
cask "localhost-mapper" do
  version "1.0.0"
  sha256 :no_check

  url "https://github.com/outscoper/localhost-mapper/releases/download/v#{version}/Virtual.Host.Manager-#{version}-arm64.dmg"
  name "Virtual Host Manager"
  desc "Apache reverse proxy manager for local development"
  homepage "https://github.com/outscoper/localhost-mapper"

  app "Virtual Host Manager.app"

  caveats <<~EOS
    This app is not code-signed. On first launch, macOS may block it.
    To allow it, open System Settings → Privacy & Security → click "Open Anyway".

    Alternatively, run:
      xattr -cr "/Applications/Virtual Host Manager.app"
  EOS
end
```

6. Commit and push to the tap repo.

---

### Step 2 — Generate a GitHub Personal Access Token

1. Go to **GitHub → Settings → Developer Settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token (classic)**
3. Give it a name: `homebrew-tap-updater`
4. Select scope: `repo` (full repo access)
5. Click **Generate token** and **copy the token** — you won't see it again

---

### Step 3 — Add the Token as a Secret in the Main Repo

1. Go to your `localhost-mapper` GitHub repo
2. Go to **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Name: `TAP_GITHUB_TOKEN`
5. Value: paste the token from Step 2
6. Click **Add secret**

---

### Step 4 — Update `package.json`

Add a `publish` block inside the `build` config in `package.json`:

```json
"build": {
  "appId": "com.virtualhostmanager.app",
  "productName": "Virtual Host Manager",
  "publish": [
    {
      "provider": "github",
      "owner": "outscoper",
      "repo": "localhost-mapper"
    }
  ],
  ...
}
```

Replace `outscoper` with your actual GitHub username.

---

### Step 5 — Create the GitHub Actions Workflow

Create the file `.github/workflows/release.yml` in the main repo:

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

jobs:
  release:
    runs-on: macos-latest
    permissions:
      contents: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Build and publish
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: pnpm build

      - name: Get version
        id: version
        run: echo "VERSION=${GITHUB_REF_NAME#v}" >> $GITHUB_OUTPUT

      - name: Calculate SHA256
        id: sha256
        run: |
          FILE="release/Virtual Host Manager-${{ steps.version.outputs.VERSION }}-arm64.dmg"
          SHA=$(shasum -a 256 "$FILE" | awk '{print $1}')
          echo "SHA256=$SHA" >> $GITHUB_OUTPUT

      - name: Update Homebrew Tap
        env:
          TAP_GITHUB_TOKEN: ${{ secrets.TAP_GITHUB_TOKEN }}
          VERSION: ${{ steps.version.outputs.VERSION }}
          SHA256: ${{ steps.sha256.outputs.SHA256 }}
          GITHUB_USERNAME: outscoper
        run: |
          git clone https://$TAP_GITHUB_TOKEN@github.com/outscoper/homebrew-localhost-mapper.git tap
          cd tap
          sed -i '' "s/version \".*\"/version \"$VERSION\"/" Casks/localhost-mapper.rb
          sed -i '' "s/sha256 .*/sha256 \"$SHA256\"/" Casks/localhost-mapper.rb
          git config user.email "github-actions@github.com"
          git config user.name "GitHub Actions"
          git add Casks/localhost-mapper.rb
          git commit -m "chore: update localhost-mapper to v$VERSION"
          git push
```

> **Note:** Replace `outscoper` in the workflow file with your actual GitHub username.

---

## Part 2: Releasing a New Version

Every release follows this simple process:

### Step 1 — Bump the version in `package.json`

```json
"version": "1.1.0"
```

### Step 2 — Commit the version bump

```bash
git add package.json
git commit -m "chore: bump version to 1.1.0"
git push
```

### Step 3 — Create and push a git tag

```bash
git tag v1.1.0
git push origin v1.1.0
```

That's it. GitHub Actions will automatically:
- Build the DMG for arm64 and x64
- Create a GitHub Release and upload the DMG
- Update the Homebrew Tap formula with the new version and SHA256

---

## Part 3: User Installation

### Install via Homebrew

```bash
# Add the tap (one-time)
brew tap outscoper/localhost-mapper

# Install the app
brew install --cask localhost-mapper
```

### Upgrade to a newer version

```bash
brew upgrade --cask localhost-mapper
```

### Uninstall

```bash
brew uninstall --cask localhost-mapper
brew untap outscoper/localhost-mapper
```

---

## Part 4: Gatekeeper Warning (No Code Signing)

Because the app is not code-signed with an Apple Developer certificate, macOS will show a security warning on first launch.

**Option A — Via System Settings:**
1. Try to open the app — macOS blocks it
2. Go to **System Settings → Privacy & Security**
3. Scroll down and click **"Open Anyway"**

**Option B — Via Terminal:**
```bash
xattr -cr "/Applications/Virtual Host Manager.app"
```

Then open the app normally.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| GitHub Actions fails on build | Check that `pnpm install` completes successfully in CI |
| DMG filename mismatch in workflow | Check the exact filename in `release/` directory and update the workflow |
| Tap formula not updated | Verify `TAP_GITHUB_TOKEN` secret is set and has `repo` scope |
| `brew install` can't find cask | Make sure the tap repo is **public** |
