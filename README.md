# BlueSky Wi-Fi — GitHub + Google Apps Script OTP starter

STATUS: Email OTP implementation provided. NOT a completed captive portal.
Internet authorization for Linksys remains unimplemented and untested. Do not
attach this starter to the live visitor SSID yet.

## Setup
1. Open script.google.com with the Gmail account that has inventory@blueskycoffe.com
   as a verified Gmail “Send mail as” alias. Create a standalone Apps Script project.
2. Paste apps-script/Code.gs into Code.gs. Add an HTML file named Portal and paste
   apps-script/Portal.html into it.
3. Run setupProject_ from the editor. Authorize only after checking the project.
   GmailApp requires broad Gmail permissions; this package only sends OTP mail.
   Setup checks the sender alias and stores a secret in Script Properties.
4. Deploy > New deployment > Web app. Execute as: Me. Access: Anyone
   (if your Google account/organization permits anonymous web apps).
5. Copy the /exec URL into APPS_SCRIPT_URL in github/index.html.
6. Upload github/index.html to your chosen GitHub repository and enable Pages.
   The GitHub page links to the Apps Script hosted form. This avoids depending on
   cross-origin fetch responses, JSONP, or exposing the OTP secret in GitHub.
7. Test using your own email: send, verify, resend, incorrect code, expired code,
   and reused code. Verification must say authorization is pending.
8. Code changes require a new deployment version via Manage deployments.

## Controls
- 5-minute expiry, 60-second resend delay, 5 wrong attempts.
- Maximum 5 sends/email/hour and 80 total/day (Riyadh date); Gmail quota may be lower.
- HMAC hashes stored instead of plaintext OTP/email in Script Properties.
- ScriptLock protects request counters and one-time consumption.
- No SMTP password, private key, or reusable Wi-Fi credential in GitHub.
- setupProject_ and helpers have trailing underscores: not exposed to script.run.
- Expired records are cleaned on subsequent requests; Gmail retains sent mail.
- No IP address is exposed by Apps Script, so per-IP abuse prevention is absent.
  The global cap limits mail costs/abuse, but someone can exhaust the cap.
  A fully public production service needs stronger anti-abuse controls.

## Required before Linksys activation
Obtain the CURRENT external captive portal protocol/API documentation for this
Linksys Cloud Manager network and LAPAC1300C firmware. Determine whether a
supported authorization callback, signed session protocol, or external RADIUS
service is required. Do not assume legacy Tanaza endpoints work with Linksys.
Implement server-side authorization bound to the validated client session.
Never accept a visitor-supplied “verified=true” flag or redirect URL as proof.
A successful OTP alone does not unlock Wi-Fi; no unlock endpoint is fabricated.
RADIUS UDP cannot be hosted by Apps Script directly; if required, a separate
RADIUS server/provider is needed, so GitHub + Apps Script alone is insufficient.

Plan the pre-authentication allowlist for GitHub Pages, script.google.com and
its redirect/content dependencies. Test these on a real phone; captive browser
and Google redirects may behave differently. Email OTP also requires access to
the mailbox BEFORE login, via mobile data or a narrowly scoped, verified access
policy. Broadly allowing mail-provider domains can inadvertently bypass limits.
Keep visitor traffic isolated from office LAN. Confirm guest security and
session limits before any live change. Do not remove WPA2 as part of this starter.

## Validation
Local mocked Apps Script flow tests are included in the development validation,
but actual Gmail delivery, anonymous deployment, mobile captive-browser behavior,
and Linksys authorization require live tests. This package is not deployed.
