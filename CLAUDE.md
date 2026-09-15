# TwitchAdSolutions

Fork of pixeltris/TwitchAdSolutions (archived). Remote `origin` = pixeltris, remote `master` = ryanbr.

## Worker Blob Serialization (CRITICAL)

Functions serialized via `.toString()` into the Web Worker blob CANNOT reference outer-scope variables. This includes: `processM3U8`, `stripAdSegments`, `hookWorkerFetch`, `probeBackupPlayerType`, `fetchBackupMediaM3u8`, `getAccessToken`, `gqlRequest`, `hasAdTags`, `getMatchedAdSignifiers`, `notifyAdComplete`, `getStreamUrlForResolution`, `parseAttributes`, `getServerTimeFromM3u8`, `replaceServerTimeInM3u8`, `pruneStreamInfos`, `createStreamInfo`, `getWasmWorkerJs`, `videoCodecFamily`.

- Declare variables in `declareOptions()` (also serialized) or in the inline blob template literal
- To pass window-scope values to the worker, inject after `declareOptions(self)`: e.g. `ReloadPlayerAfterAd = ${ReloadPlayerAfterAd};`
- Regex hoisting or referencing outer-scope variables from these functions causes `ReferenceError`

## Files

Synced pairs (same logic, different format):
- `vaft/vaft.user.js` + `vaft/vaft-ublock-origin.js`
- `vaft/vaft_testing.user.js` + `vaft/vaft-testing-ublock-origin.js`
- `video-swap-new/video-swap-new.user.js` + `video-swap-new/video-swap-new-ublock-origin.js`
- `video-swap-new/video-swap-new-ublock-origin-testing.js` (testing only)
- `strip/strip.user.js` (standalone)

uBlock files have `twitch-videoad.js text/javascript` as line 1 (not valid JS — uBlock resource header).

## Naming Differences

| | vaft | video-swap-new | strip |
|---|---|---|---|
| Signifiers | `AdSignifiers` | `AD_SIGNIFIERS` | N/A |
| URL patterns | `AdSegmentURLPatterns` | `AD_SEGMENT_URL_PATTERNS` | N/A |
| Player type | `ForceAccessTokenPlayerType` | `OPT_FORCE_ACCESS_TOKEN_PLAYER_TYPE` | `ForceAccessTokenPlayerType` (default `site`) |
| Reload after ad | `ReloadPlayerAfterAd` | `ReloadPlayerAfterAd` | `ReloadPlayerAfterAds` |

## Versions

Bump `@version` (userscript header) and `ourTwitchAdSolutionsVersion` together for functional changes. Current: vaft 68.5.14/98, video-swap-new 1.87/55, strip 1.10/27. Testing: vaft 680.0.0/682, video-swap-new -/621.

## localStorage Config

All read at init, injected into worker blob:
- `twitchAdSolutions_reloadPlayerAfterAd` — `true`/`false`, default `true`
- `twitchAdSolutions_playerType` — string, default `popout`
- `twitchAdSolutions_pinBackupPlayerType` — `true`/`false`, default `false` (vaft default `true`)
- `twitchAdSolutions_hideAdOverlay` — `true` to hide the internal `.tas-adblock-overlay` banner (SDA wrapper hide always runs), default not set
- `twitchAdSolutions_autoUnmute` — `false` to disable auto-unmute, default on (vaft). Clears Twitch-set mutes (page load / autoplay policy, post-ad, silent re-mute) on the buffer-monitor tick, syncing `video.muted` and the `[data-a-target="player-mute-unmute-button"]` DOM button. Stands down when `video-muted` localStorage is `{"default":true}` — a deliberate user mute is never overridden.
- `twitchAdSolutions_reloadCooldownSeconds` — number, default `30` (0 to disable)
- `twitchAdSolutions_disableReloadCap` — `true` to revert to unlimited reloads
- `twitchAdSolutions_driftCorrectionRate` — number, default `1.1` (0 to disable)
- `twitchAdSolutions_earlyReloadPollThreshold` — number, default `3` (0 to disable; thin cache overrides to 1)
- `twitchAdSolutions_preferLowQualityBackup` — hybrid mode (sticky escape hatch + autoplay last-resort backup), default `true`; set to `false` to disable (vaft only)
- `twitchAdSolutions_backupSwapFirst` — on ad detect, immediately swap to backup player-type m3u8 (TTV-AB-style) instead of sticky CSAI strip. Default `true` as of v63.0.0; set to `false` for legacy strip-first path (vaft only)
- `twitchAdSolutions_fastAutoplayFirstTry` — opt-out (default `true` as of v67.1.0). Prepend autoplay (360p) to position 0 of the iteration when the prior break committed autoplay via PreferLowQualityBackup escape hatch. Saves ~1.5-2s of probe-loop buffering. Auto-resets when a Source-tier type wins (channel recovered) so quality returns to full automatically. Set to `'false'` to force full Source-tier probe on every break (vaft only)
- `twitchAdSolutions_recoverFromSilentMute` — opt-out (default `true`). On hard reload, if the element is already muted but vaft has successfully unmuted at any point earlier this session, recover via the 5500ms backstop (Twitch's silent re-mute pattern — issue #200). Disable via `'false'` if you deliberately mute mid-session and want that preserved across reloads. Users muted from session start are always respected (vaftEverUnmuted=false short-circuits the recovery check). vaft only.
- `twitchAdSolutions_disableAdSpoofing` — opt-in via `'false'` (default `'true'` — spoofing is OFF). When enabled, on ad detect vaft fires the GQL ad-tracking beacons (`video_ad_impression`, `video_ad_quartile_complete` × 4, `video_ad_pod_complete`) that Twitch's player would have sent if the ad had played normally. Originally intended to mimic the ad-completion signal Twitch expects and may reduce detection escalation — but the always-100%-watched + audible + visible beacon pattern may itself fingerprint as anomalous (silently, without GQL rejection) and trigger detection escalation in the other direction (observed correlation with CSAI ads reaching committed backups + TTV-AB maintainer hypothesis). Default flipped from on→off after v68.2.0. Set to `'false'` to re-enable (for A/B testing whether spoofing affects ad break duration / CSAI escalation on your channels). Failures swallowed (never blocks ad-block flow). vaft only.
- `twitchAdSolutions_disableInAdGapSeek` — opt-out via `'true'` (default off = feature on). Disables the in-ad frozen-buffer-gap seek (v660, TTV-AB #33 mirror) for A/B isolation of mid-break pause/loading-circle reports. vaft testing only.
- `twitchAdSolutions_disableInAdFreezeReload` — opt-out via `'true'` (default off = feature on). Disables the in-ad frozen-playhead reload escalation (v662, audio-gap CSAI backstop) for A/B isolation. vaft testing only.
- `twitchAdSolutions_disablePostBreakWedge` — opt-out via `'true'` (default off = feature on). Disables the post-break video-wedge recovery (v667/v68.5.0, TTV-AB _checkPostBreakWedge mirror) for A/B isolation.
- `twitchAdSolutions_disableBackgroundResume` — opt-out via `'true'` (default off = feature on). Disables the hidden-tab resume guard (v672, issue #255): a Twitch-initiated pause while the tab is hidden is resumed with a retry chain (strike-capped so a deliberate media-key pause is respected) instead of staying paused until tab focus. vaft testing only.
- `twitchAdSolutions_blockCsaiAdRequests` — opt-out via `'false'` (default on as of v68.5.13). Fails every `edge.ads.twitch.tv` request (fetch: rejected `TypeError`; XHR: async DONE/status 0 + `error`/`loadend`) the way a network filter would, so the ad SDK never gets a creative and the separate video-ad slot (#249) is never rendered. Detection trade-off accepted by the fork owner; the m3u8 side is untouched. vaft only.

## CSAI vs SSAI

- **SSAI** (Server-Side Ad Insertion) — ads embedded in m3u8 segments. Blockable by stripping.
- **CSAI** (Client-Side Ad Insertion) — ads delivered via `edge.ads.twitch.tv`, outside m3u8. Not blockable at m3u8 level. Detected via fetch/XHR hooks; since v68.5.13 those requests are failed like a network filter would (`BlockCsaiAdRequests`, opt-out via localStorage) so the client-side creative — and the separate video-ad slot it feeds — never arrives. Logged either way (`CSAI ad request (fetch, blocked)`).
- When `hadStrippedSegments === false` (CSAI-only), skip reload entirely to prevent cascade.

## Key Architecture (vaft)

- **Buffer monitor** (`monitorPlayerBuffering`) — polls player state every 1-3s (visibility-aware). Detects stalls, fires pause/play or reload.
- **Reload cooldown** — 30s default, auto-escalates to 90s if 3+ reloads in 5 minutes.
- **Reload cap** — buffer monitor reloads at most once per recovery window (`recoveryReloadUsed`).
- **Grace periods** — 15s after reload, 10s after backup switch. Buffer monitor skips fixes during these.
- **Drift correction** — `startDriftCorrection(videoElement)` shared function. 1.1× playback rate, 30s safety timeout. Restarts fresh on re-entry (clears stale timers). Used by post-reload drift and buffer gap seek.
- **Reload routing** — worker → main `ReloadPlayer` messages carry a `kind` field. `doTwitchPlayerTask(isPausePlay, isReload, reloadKind)` picks `setSrc` params: `kind === 'early'` → hard reload (`isNewMediaPlayerInstance: true, refreshAccessToken: true`, new session); otherwise soft reload. The two flags are **not** coupled: on Apple touch devices `iosSoftReload` downgrades `isNewMediaPlayerInstance` to false while `refreshAccessToken` stays true (v68.5.5 — not yet validated on a device). Early reload sites (both sticky + normal paths) send `kind: 'early'`; post-ad reload sites send `'post-ad'` when `SoftReloadNoStrip` is on and the break stripped nothing (v68.5.0), `'early'` otherwise. HEVC force reload stays soft (codec change, no strip involved). Hard reload flushes the MediaSource buffer — required after strip activity (BLANK_MP4 injection, recovery replay) to avoid audio/video desync from accumulated timestamp drift.
- **Early reload** — fires during prolonged all-stripped freeze. Threshold: 3 polls (~6s), or 1 poll when recovery cache <3 segments (thin-cache fast path). Budget: `max(1, PodLength)` or `max(2, PodLength)` when thin. `EarlyReloadTriggered` resets on "still ads" (both sticky + normal paths) to allow budget-based re-fire. Override via `twitchAdSolutions_earlyReloadPollThreshold`.
- **Preroll backup warm-up** — on the first poll of a non-midroll break (page load / channel switch) `processM3U8` starts `probeBackupPlayerType()` (token → usher → media m3u8) for every cold candidate type concurrently, stored in `streamInfo.BackupProbePrefetch`; the sequential probe loop then awaits them in its normal order, so commit/fallback semantics are unchanged but the ~2s serial black screen collapses to one round-trip. Leftovers are dropped after the loop. Midroll and later polls stay sequential (pinned type is warm there).
- **Sticky CSAI fast path** — once a break enters CSAI fast path (all segments live), stays on it for the whole break. Has its own early-reload trigger + `EarlyReloadAwaitingResult` check (normal-path check unreachable due to early return).
- **Latency-aware reload health check** — measures `seekable.end - currentTime` before skipping post-ad reload. If >7s behind live or seekable unavailable/garbage, proceeds with reload. Guards against 2^30 sentinel values via `Number.isFinite` + 3600s cap.
- **User pause intent** — tracks video pause/play events to distinguish user vs script pauses. `weJustPaused` only resets when player wasn't paused (guards against clearing intent during stall recovery).
- **Stale player ref** — `playerForMonitoringBuffering = null` on reload to force re-acquisition.
- **StreamInfo factory** — `createStreamInfo()` declares all fields up-front (52 fields vaft, 31 fields video-swap-new). Serialized into worker blob.

## Debug Logging

All logs use `[AD DEBUG]` prefix. Logs in `.toString()` functions must use `console.log` directly. Some logs are deduped (once per ad break or once per page load) to prevent console spam.

## Validation

`npx acorn --ecma2022 file.js` (skip line 1 for uBlock files: `tail -n +2 file.js | npx acorn --ecma2022`). GitHub Actions validates on push/PR.

## Testing

Testing files include experimental features (ad completion spoofing, lower thresholds, removed pruneStreamInfos). Don't apply to main scripts without explicit request. Testing-script-only changes commit directly to master; PRs are for release scripts.

## Backup Player Types

- **vaft**: `embed`, `site`, `popout`, `mobile_web` (autoplay removed — gets stuck in loading circle on transition back)
- **video-swap-new**: `embed`, `popout`, `mobile_web` (autoplay + picture-by-picture removed)

## Auto-Unmute

`autoUnmutePlayer()` runs on the same buffer-monitor tick as the overlay hide. It clears mutes Twitch sets itself and
never overrides the user:
- **User intent** is read from Twitch's own `video-muted` localStorage key (`{"default":true}` when muted via the UI) —
  the same signal the post-reload restore in `doTwitchPlayerTask` trusts. When set, the function returns immediately.
- **Both layers are synced** — `video.muted` (the media element) and the DOM button (Twitch's React state), because
  they diverge: fixing only the element can leave the UI stuck on "unmute" and be re-asserted on the next render.
- **The mute state is sampled before it is cleared.** Twitch does not expose `aria-pressed` on this button, so the
  fallback uses the entry-time element state. Reading it after the fix would always see `false` and the click would
  never fire; conversely, clicking an already-unmuted button would *mute* the stream, so the click is gated on the
  player actually having been muted on entry.
- Matched via `data-a-target` only — the class names in Twitch's markup are generated, and `aria-label` is localized.

Disable with `twitchAdSolutions_autoUnmute='false'`.

## Ad Overlay Hiding

`hideTwitchAdOverlays()` hides these during ad blocking:
- **Stream display ads (SDA)** — via exact selectors on the ad's own nodes, no parent walking: `[data-test-selector="sda-wrapper"]` plus the layout container (`[data-test-selector="sda-container"]`, `[data-a-target="sda-container"]`). Both carry the 90px reserved height, so both are hidden (v68.5.10).
- **SDA black bar / column** — hiding the SDA nodes is only half the fix. Twitch *independently* shrinks the video to make room for the banner with inline percentage sizes on `[data-a-target="video-ref"]`. Two variants: **lower-third** (`height: calc(79.0698% + 0px)` + `video-player--stream-display-ad_lower-third`) and **squeezeback** (`height: calc(85.1206% + 0px)` **and** `width: calc(85.2143%)` + `video-player--stream-display-ad_squeezeback` — a tall vertical creative down the right edge). With the ad hidden, the reserved strip is empty player background — a **black bar across the bottom** and, for squeezeback, a **black column down the right**. The tick guard checks each axis on its own and forces `height`/`width: 100%` while Twitch's percentage shrink is present, re-asserted every tick (React re-applies it), released when Twitch clears its own inline sizes. Matched on the stable `data-a-target` — the `Layout-sc-*` classes on these nodes are styled-components output and must never be matched (v68.5.11, width v68.5.14).
- **SDA pre-paint stylesheet** (v68.5.14) — the init `<style>` (see #249 below) also carries `[data-test-selector="sda-wrapper"], [data-test-selector="sda-container"], [data-a-target="sda-container"] { display: none !important }` and an un-squeeze rule `[data-a-target="video-ref"].video-player--stream-display-ad_lower-third, [...]_squeezeback { height: 100% !important; width: 100% !important }`, so neither the banner nor the black bar/column paints while waiting for a tick (600ms, ~9s on a hidden tab). The state classes are Twitch's hand-written BEM names (same category as `.outstream-controls`), which is why they are acceptable in a selector; the `Layout-sc-*` hashes are not. The tick guard's inline override stays as the fallback if a class is renamed.

Called on every buffer monitor tick, from session start and regardless of ad state — it is deliberately NOT gated on `cachedPlayerRootDiv` (that cache is only populated by `updateAdblockBanner()` during an ad break, which previously left the SDA hide dead until the first break). Guards via `dataset.tasHidden` to skip already-hidden elements.

- **Separate video ads (#249)** — `<video>` whose src host is `media-amazon.com` (the live player is always `blob:`, so this cannot false-positive) is hidden + muted + **fast-forwarded** (`playbackRate` 16, stepping down to 8/4 if the browser throws; `play()` if paused). It is NOT paused: a paused ad never fires `ended`, so Twitch's ad UI sat on "Play ad · 0:15" until its own timeout and the black slot stayed for the whole break — at 16x a 15s creative ends in ~1s and Twitch collapses the slot itself. Note the ad SDK therefore reports a completed view for every ad (deliberate trade-off, chosen over the stuck slot). Two extra hides ride on it: the video's **parent** (the slot's inline `background-color: black` wrapper) when its only other children are `hidden` label spans — this is the single sanctioned one-level parent step, anchored on the ad element and verified by inline style + child composition, never class names; and `.outstream-controls` (Twitch's hand-written class for the slot's Play-ad / Unmute-ad bar), hidden only while an ad video is present. All three restore themselves (recycled node no longer an ad → `playbackRate` back to 1; backdrop without a hidden ad video inside; controls when no ad video is on the page). The "Ad 1/2 · 0:15" pill has no stable attribute and is left alone — it goes away with the slot. On top of the tick-based guard, a `<style>` installed at init (document-start) hides the slot **before first paint**: `video[src*="media-amazon.com/"]`, `.outstream-controls`, and the collapsible slot container `div[style*="transition: max-height"]:has(.outstream-controls, video[src*="media-amazon.com/"])` — three separate rules so a browser without `:has()` only loses the container rule. Restore is implicit (every rule keys off something only the ad has) (fast-forward + parent/controls hide v68.5.12, stylesheet v68.5.13).

**Previously removed:**
- Turbo promo / "allow ads" overlay hide (PR #143) — used `.player-overlay-background` which is Twitch's generic modal scrim (also used for content gates, error dialogs, subscription warnings). Too broad to use safely.
- Ad-break-card text match (PR #141) — scanned `span/p/h1/h2/h3` text for "taking an ad break" phrases then walked up via fuzzy `[class*="overlay"]` + `parentElement` fallback. Could hide player controls on false matches. TTV-AB doesn't attempt this either.

Only keep overlay hides that use exact attribute selectors with no parent walking — the one exception is the verified one-level parent step in the separate-video-ad guard above.
