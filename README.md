<h1 align="center">
  <img src="media/icon.png" alt="Twitch Enhancer icon" height="26px" /> Twitch Enhancer
</h1>

Modular browser extension for Twitch that combines several quality-of-life improvements in one place. Designed as a unified replacement for multiple separate Twitch userscripts, it offers shared settings, per-module toggles, and separate builds for **Chrome/Chromium** and **Firefox**.

It currently includes [**Toggle Video Quality**](https://github.com/Vikindor/twitch-toggle-video-quality), [**Keep Tab Active**](https://github.com/Vikindor/twitch-keep-tab-active), **Auto Claim Bonus**, **Block Annoyances**, [**Force Sort Viewers High to Low**](https://github.com/Vikindor/twitch-force-sort-viewers), and [**Show Stream Language**](https://github.com/Vikindor/twitch-show-stream-language).

Especially useful for people who like to **keep streams running in the background** to support streamers, farm **channel points**, or keep streams running for **Drops** with less manual babysitting.

> ⚠️ This extension does not block ads and does not attempt to bypass Twitch ad delivery.

## ✨ Features

<img src="media/screenshot_1.jpg" width="75%" alt="Features screenshot 1" title="Features"/>

### 1️⃣ Toggle Video Quality

- **Main action-button feature (LMB click on extension icon)**
- Switches between low and preferred high quality
- Supports tab mute or player mute
- Can restore both tab and player audio when returning to high quality

### 2️⃣ Keep Tab Active

- Multiple strategies to keep streams alive in the background
- Can dismiss Twitch overlays such as `Start Watching` and network errors
- Can request a screen wake lock when supported

<img src="media/screenshot_2.jpg" width="75%" alt="Features screenshot 2" title="Features"/>

### 3️⃣ Auto Claim Bonus

- Polls for the `Claim Bonus` button under the chat
- Claims channel points bonuses automatically

### 4️⃣ Block Annoyances (disabled by default)

- Hides selected Twitch UI elements without blocking ads or modifying stream delivery
- Provides a separate checkbox for each supported element:
  - Auto-pause promoted streams on the homepage
  - Cookies consent banner
  - Header buttons for News from Luna and Bits
  - Stories in the left navigation panel
  - Chat leaderboard and goals panel
  - Player extensions
  - Channel header buttons for Bits, Gift Subs, Subscribe, and Continue Sub
- Can block all player extensions at once, including potentially useful ones
- Alternatively, can block only extension dock buttons or the Prime Benefits dropdown

<img src="media/screenshot_3.jpg" width="75%" alt="Features screenshot 3" title="Features"/>

### 5️⃣ Force Sort Viewers

- Nudges Twitch directory pages toward `Viewers: High to Low` sorting
- Supports per-load and per-tab-session run policies

### 6️⃣ Show Stream Language

- Displays the stream language like `[EN]` / `[JA]` / etc.
- Two visual modes: a badge on the preview card or a suffix next to the streamer's username

### ➕ Per-module settings and toggles in a shared options page

<img src="media/screenshot_4_firefox.jpg" width="75%" alt="Options Firefox screenshot 4" title="Firefox"/>
<img src="media/screenshot_4_google.jpg" width="75%" alt="Options Google screenshot 4" title="Google/Brave"/>

## 🚀 Installation

### Option 1: Install from the store

<a href="https://chromewebstore.google.com/detail/twitch-enhancer/mfmhbfdnihfhndicfkagemohhcmdahbf" target="_blank" rel="noopener noreferrer">
  <img src="media/chrome_web_store_badge.png" alt="Chrome Web Store badge" title="Chrome Web Store" />
</a>
<br><br>
<a href="https://addons.mozilla.org/en-US/firefox/addon/twitch-enhancer-extension/" target="_blank" rel="noopener noreferrer">
  <img src="media/firefox_store_badge.png" alt="Firefox Add-ons badge" title="Firefox Add-ons" />
</a>

### Option 2: Load the unpacked extension

First, build the project.

Just run:

```
RUN_build.bat
```

Or through the console:

```powershell
node .\build.js
```

#### Chrome / Brave / Edge

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `builds\chrome`

#### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `builds\firefox\manifest.json`

## ⚠️ Notes & Limitations

- This extension does not block ads and does not attempt to bypass Twitch ad delivery.
- The extension action button currently triggers `Toggle Video Quality` specifically.
- `Keep Tab Active` may behave differently across browsers or Twitch updates.
- Browser throttling with a large number of open tabs is controlled by the browser itself, and the extension cannot override it.
- If you run into throttling-related playback issues, using tab mute is generally more reliable than muting the Twitch player directly.
