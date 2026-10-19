# Test results

Tested October 18, 2026, with Node.js v24.19.0. All AI calls were mocked. No real API key was read, included, or requested. No live OpenRouter request or deployment was performed.

## Automated tests: 28 passed, 0 failed

Run again with `npm test` or `node --test tests/*.test.mjs` from this folder. No dependency installation or key is needed.

| Area | Result |
| --- | --- |
| Extraction (5 tests) | Passed: sample has exactly two unique citations; repeated Brown references deduplicate; spacing/case normalization; common federal/state/regional reporters; verbatim bounded excerpts; empty input and repeatability. |
| Interface handlers (10 tests) | Passed: sample loading, passage display, Clear, blank/no-match states, invalidating stale results, changing selections with a five-citation cap, single request during loading, safe text rendering, service errors, malformed responses, timeouts, and network-error recovery. These automated tests use a minimal DOM double. |
| Server handling (13 tests) | Passed: exact endpoint and model, one upstream call for five citations, authorization kept server-side, zero-price provider ceiling, valid request shape, method/media-type/origin rejection, missing key, body/text/output limits, prompt/data separation, response schema and role validation, credential-safe error handling, no retries, abort timeout, and declared Netlify rate-limit configuration/path. |

Passing tests of prompt/data separation do not establish that a real model will resist every prompt injection or produce accurate legal interpretations.

## Browser checks: passed using the offline mock preview

The browser loaded the actual HTML/CSS/modules from the localhost helper and exercised the same function logic with a substituted upstream response.

- Page loaded with an explicit **OFFLINE MOCK PREVIEW** label and disabled Analyze button before extraction.
- Sample loaded, visibly labeled as a teaching example; extraction displayed `347 U.S. 483` and `384 U.S. 436` with two unique citations and two selected.
- Repeated Brown references appeared under one citation. Original surrounding excerpts remained visible.
- Analyze completed and displayed mock explanations and tentative roles for both citations.
- Clear emptied the text and cards and disabled analysis.
- No-citation text showed the no-match message.
- Six synthetic reporter references produced six cards with only five selected. The sixth checkbox was disabled until one of the selected citations was unchecked. Selecting the sixth and analyzing produced five mock results.
- A screenshot confirmed readable layout at the browser's existing narrow viewport, where source and explanation stack vertically. Wide-screen columns are defined in CSS but were not separately tested at a forced viewport size.

The screenshot is stored outside the upload folder at `../output/citation-context-explorer-preview.jpg`.

## File checks

- SHA-256 checks confirmed the original `basic-app.html` and all three annotation-assignment files were unchanged.
- The upload folder contains no `.env` files, real credentials, private keys, dependencies, or generated Netlify state. Explicit mock sentinels in tests/preview are not credentials.
- The frontend contains no OpenRouter API URL, authorization header, or key-reading logic. Its only analysis request goes to the same-origin function.
- No frontend build step or external runtime dependency is required. `netlify.toml` publishes only `public`; server code and tests are outside the public directory.

## Requires deployment and/or a live key — not run

- Netlify's actual function bundling/routing, deployed CSP headers, environment-variable availability, and rate-limit enforcement.
- Authentication with the owner's real OpenRouter key.
- Current availability of a compatible `openrouter/free` provider with JSON output and zero-price routing.
- Actual AI explanation quality, tentative-role accuracy, real free-tier quotas, latency, and timeouts under deployment conditions.

When ready, follow the README to deploy and set `OPENROUTER_API_KEY` in Netlify, then use the labeled sample and click Analyze citations. That will be a live request. Visitors will not need to enter a key.
