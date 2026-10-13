# Pink October booth · GDG MAHE Dubai

**One Heart. One Fact. One Action.** A free, plain-JavaScript breast cancer awareness booth: play a short challenge, read a sourced fact, and take away a portrait story. Two modes share one finish. No account, API key, backend, or paid service is required.

MediaPipe hand/face tracking runs locally in the browser. Video is not uploaded or recorded by the app. Optional photos and story previews stay in memory until cleared; saving or sharing requires a click. Requested downloads remain on the device after reset. External requests load MediaPipe, its models, and Google Fonts; internet access is required for reliable setup. Browser caching is not an offline guarantee.

## Run

Install Node.js with npm, then run from this folder:

```bash
npx serve -l 8742
```

Open **http://localhost:8742** in Chrome on the booth laptop and allow the camera. `npx` may ask to install `serve` on first use. No build step is needed. Use localhost or HTTPS: ordinary HTTP over a laptop's network IP does not provide the secure context required for camera access. Opening `index.html` directly also prevents reliable ESM module loading. [Camera access requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

## Modes and shared finish

- **Draw Hope:** after a three-second countdown, pinch to trace with v2’s pinch hysteresis, One Euro smoothing, stroke capture, palm clearing, and heart scoring. Once roughly 70% of the guide perimeter is drawn at guide scale, returning near the start or releasing the pinch for 1.5 seconds finishes. Reset clears ink; the small Done button is a fallback. There is no round timer or coverage-only finish. V2 stars and confetti appear for three seconds before the shared fact/story/counters ending. The tracing score is only a game score.
- **Team mode (optional in Draw Hope):** solo is the default. Enable “Team mode · one half each” to restart the countdown with two hands. Each hand pinches on its own side of the displayed heart centre to claim that half; ink stops at the centre boundary. Trace together. Existing pinch trackers, completion rules, and scorer are reused; both hands’ strokes receive one combined score. The finish also reports the percentage of guide samples reached on each half. Reset clears ink and half assignments.
- **Myth or Fact:** pick between two written answers using the same tilt mechanic. Each game selects four random, unique questions from the supplied `js/questions-bank.js` ESM bank and independently randomizes the correct answer's side. Tap either answer or use left/right arrows even when camera or model loading fails. For tilt, look straight to calibrate, then hold toward an answer for 0.7 seconds. The live meter, Recenter, Swap and face-loss behavior are unchanged. Swap changes gesture input only; taps and arrow keys still select the displayed side. Each reveal shows the correct answer and awareness source links.

Camera screens use a 32px semi-transparent header with Back and Booth controls available. The landing header is unchanged.

Both modes stop the camera and show one of eight short WHO-checked awareness facts. The shuffle bag uses every fact once before refilling; remaining indices persist in localStorage with an in-memory fallback. A new completed challenge draws a fact; previews and photo retakes retain it.

**Make my story** previews the actual **1080×1920 PNG**, containing artwork, the selected fact, source, branding, and **#GDGPinkOctober**. Scores and stars stay on the result screen and never appear in the story. A locally generated QR code labelled “Scan: WHO fact sheet” opens the WHO breast cancer fact sheet when scanned. QR generation makes no network request.

**Add optional photo** starts the camera again. Hold a two-hand heart or tap Take photo for a three-second countdown. A visible face is required; losing it cancels the countdown. After Draw Hope, the player's actual completed strokes are normalized without dropping samples, drawn flat pink beside the head, and positioned/scaled from Face Landmarker landmarks. Move to adjust the pose before capture. No glasses, cheek/forehead decorations or stock face hearts are used. A quiz-only photo has no drawn-heart overlay. The saved photo contains the same mirrored heart overlay, matches the preview's aspect ratio, and replaces the story artwork while retaining the fact and result score. Retake repeats the photo finish. Normalized photo-overlay strokes stay in memory and clear on return home/Next visitor; the existing local heart wall is separate.


**Share story** offers file sharing where supported; unsupported or failed sharing requests a download. Cancelling the share sheet does not download. **Download PNG** saves on the current device. These actions do not prove a file was saved or posted. There is no phone-transfer service.

Finishing Draw Hope or Myth or Fact plays a short, quiet synthesized WebAudio chime and a small flat ribbon animation. **Mute** in Booth controls persists in localStorage; unavailable storage falls back to the current page’s setting. Audio requires a browser interaction and is optional if blocked. Reduced-motion preferences suppress the ribbon animation. No audio files or additional runtime network requests are used.

## Vendored library

Story QR generation uses Kazuhiko Arase’s **QR Code Generator for JavaScript**, vendored in `vendor/qrcode.js` under the MIT license (`vendor/qrcode-LICENSE`). A local default ESM export was added; no CDN is used for this library.

## Camera and iPhone tip

The Camera menu lists devices exposed by the browser after permission. Its selection is remembered locally; an unavailable saved camera falls back to the default. Changing cameras during an activity restarts that activity and calibration.

For an iPhone used as a Mac webcam, set up Apple's built-in [Continuity Camera](https://support.apple.com/en-us/102546), then select the iPhone in the booth's Camera menu. Check Apple's device/account requirements, mount the phone securely, and rehearse with that exact setup. The booth cannot turn a phone into a webcam itself. If opening the page on an iPhone instead, use HTTPS; `localhost` on the phone refers to the phone, not the laptop.

**F** toggles fullscreen where available; **D** toggles the tracking debug overlay. Shortcuts are ignored in form controls. During an activity, about 75 seconds without detected hands/faces or input ends the session and stops the camera.

## Organizer stats

Open **Organizer stats** on the home screen or press **S**. Use **one tab per booth**. localStorage holds totals and current-session deduplication flags, never photos, landmarks, names, or health information:

- Sessions started: first challenge opened in a session, not verified unique people.
- Draw Hope / Myth or Fact completions: each mode counts once per session.
- Exports: sessions with a download request or completed share handoff, not verified saves or posts.

Retries, multiple modes, reloads, and **← Booth** retain the same session. **Next visitor** clears the result and ends it; the next challenge starts another. Results time out after 45 seconds regardless of camera activity. **More time** restarts that timer; adding a photo pauses it until the next result.

Export totals with **Export CSV**. **Reset event…** requires confirmation and clears the current visit and all counters on this browser. Export first. Storage failures show an operator warning; in-memory counts are lost on closing/reloading. Counts do not combine across devices, and clearing site data removes them. These totals measure participation, not learning gains or healthcare outcomes.

## Awareness content

`js/questions-bank.js` exports `PINK_QUIZ_QUESTIONS` as `[question, correctAnswer, wrongAnswer]` rows. Its supplied fact-checked content is unchanged. `js/quiz-round.js` selects four unique questions and assigns answer sides without mutating the bank. The old JSON question file and fetch have been removed. Legacy “myth”/“fact” values remain internal tilt input channels only; `tilt.js` and calibration are unchanged.

`js/awareness-facts.js` contains the eight facts and optional storage adapter; `js/shuffle-bag.js` is pure. Facts were checked on 13 October 2026 against the [WHO breast cancer fact sheet](https://www.who.int/news-room/fact-sheets/detail/breast-cancer): outcomes with early diagnosis/treatment, occurrence in men, non-cancerous lumps, painless lumps, worldwide occurrence, age, family history, and skin/nipple changes. These are general awareness statements, without personal medical advice. Checking the source is a development step; the app does not fetch it at runtime. No new external runtime requests or dependencies were added.

The optional pledge is removed from UI, story rendering, counters and CSV. Existing local counters retain sessions, mode completions and exports; obsolete pledge fields are ignored and dropped on the next save.

## Tests

```bash
node --test
```

`npm test` runs the same command. Tests use Node's built-in test runner and assertions, pure functions, and DOM/camera/canvas doubles. They cover tilt/calibration/face loss, drawing completion and scoring, shuffle-bag exhaustion/persistence, question selection/side assignment, normalized heart placement, story layout calls, fact/preview/photo lifecycle, sharing fallback, counter deduplication/storage failure, and confirmed organizer reset. App regression tests exercise camera-request races, playback cleanup, device-list failure, camera switching, fullscreen failure, and mirrored drawing export.

The ten-session counter test is a simulated counter sequence, **not ten real visitor rehearsals**. Tests do not load MediaPipe, open a webcam, inspect rendered browser pixels, validate PNG readability, or exercise a real share sheet. Question tests protect the intended bank; source review establishes factual accuracy.

## Real-webcam acceptance checklist

Run this on the actual booth laptop, browser, camera, and network before the event. It has not been completed by the automated tests.

- [ ] Cold-load the app; confirm model loading and camera permission. Deny permission and block model loading separately; the quiz must remain playable by tap/keyboard.
- [ ] Switch cameras, retry after failure, return home during camera loading, and rapidly re-enter a mode. Confirm only the current camera stays on; home/results turn it off.
- [ ] Draw, release/re-pinch, lose tracking, and Reset. Check v2 palm clearing and stroke gaps, loop/release completion after most of the heart, Done fallback, stars/confetti before the shared ending, and mirrored exported ink.
- [ ] Check left/right tilt, neutral, Recenter, Swap, and face loss. Complete all four questions using taps and keyboard as well.
- [ ] Try the optional photo by gesture and button. Leave frame during countdown; capture must cancel. Retake and check drawn-heart alignment and framing.
- [ ] Inspect downloaded PNG dimensions, readable facts, source, hashtag, and photo/drawing orientation. Test supported sharing, cancellation, and download fallback on the intended device.
- [ ] Check narrow/short screens and zoom: all answers, explanations, result controls, and organizer controls must remain reachable.
- [ ] Complete **ten consecutive visits without reloading**, using Next visitor between visits. For one completed mode per visit, expect sessions +10 and combined mode completions +10; record expected export totals beforehand. Retries and repeated clicks must not add duplicates.
- [ ] Check result timeout, More time, and clearing the previous visitor's image. Export CSV, reload to check persistence, then test cancelled and confirmed event reset. Clear rehearsal counts before the event.
