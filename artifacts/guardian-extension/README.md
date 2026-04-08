# Guardian Chrome Extension

This is a real Manifest V3 extension scaffold for Guardian Agent.

## What it does

- injects a content script into the current page
- scrapes visible checkout signals such as timers, scarcity copy, button labels, prices, and checked add-ons
- sends that payload to the Guardian API at `/api/demo/scan`
- shows the result in both:
  - an on-page floating overlay
  - the browser action popup

## Load it in Chrome

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select this folder:

```text
artifacts/guardian-extension
```

## Local API

By default the extension calls:

```text
http://127.0.0.1:3001
```

You can change that in the popup settings.

## Local test flow

1. Start the Guardian site and backend from the repo root:

```powershell
pnpm run dev
```

2. Load the unpacked extension in Chrome.
3. Open any checkout-like page, or your local Guardian website pages.
4. Click the extension icon and press `Analyze this page`.

## Notes

- The extension currently uses the existing `/api/demo/scan` backend route.
- It is designed as a first working scaffold, so it favors loadability and clarity over bundling or advanced DOM mutation handling.
