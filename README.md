# Citation Context Explorer

A separate AI-powered Class 7 project. The original `basic-app.html` and annotation-assignment files are outside this folder and have not been changed.

## What it does

1. Paste a court opinion or scholarly passage (up to 60,000 characters).
2. Click **Extract citations**. Ordinary text matching finds common U.S. reporter citations and deduplicates them by volume, reporter, and first page. Case names, years, and pinpoint pages are not part of the deduplication key.
3. Read the verbatim surrounding excerpts, then select up to five citations. The first five are selected automatically. Uncheck one to select another.
4. Click **Analyze citations**. One server request asks AI for a brief explanation and a tentative role: supporting authority, distinguishing, criticism, background, or unclear. The original passages remain beside the explanation (stacked on narrow screens).

**Load sample passage** inserts a clearly labeled teaching example with `347 U.S. 483` and `384 U.S. 436`, including a repeated Brown reference. **Clear** resets everything. Loading, timeout, rate-limit, and other error states are included; editing and repeat submissions are disabled during a request.

This is analysis of supplied text, not independent verification of authorities. Matching may miss unusual citations and produce false positives. Short forms such as “id.”, “supra,” unpublished slip opinions, statutes, and citation formats outside the reporter list are not covered. Parallel reporter references are separate citations; the app does not determine whether they identify the same case. Only up to three bounded surrounding excerpts per citation are analyzed; omitted material can change the interpretation.

## Project layout

```text
citation-context-explorer/
  public/
    index.html
    styles.css
    app.mjs
    citations.mjs
  netlify/functions/analyze.mjs
  netlify.toml
  package.json
  .gitignore
  README.md
  TEST_RESULTS.md
  tests/
    extraction.test.mjs
    interface.test.mjs
    server.test.mjs
  scripts/mock-preview.mjs
```

No frontend framework, build command, third-party runtime packages, paid plugins, or hosting-provider AI gateway is used. Use Node.js 22 or newer for local commands. No `npm install` is needed for the tests or offline preview.

## Publish with GitHub and Netlify

1. Upload the **contents of this folder**, including `.gitignore` and `netlify.toml`, to the root of your GitHub repository. Do not upload your original assignment directory, any `.env` file, or credentials. If you instead put this entire folder inside a larger repository, set Netlify's base directory to `citation-context-explorer`.
2. In Netlify, import that GitHub repository. Choose no framework. Leave the **build command empty**. The configuration file sets the **publish directory** to `public` and the **functions directory** to `netlify/functions`. Netlify bundles the function and its shared citation module automatically.
3. In Netlify's project environment-variable settings, add **`OPENROUTER_API_KEY`**, with your own OpenRouter key as its value. Keep it in Netlify, never in GitHub, frontend code, `netlify.toml`, a commit, or a screenshot. If Netlify offers scope selection, include **Functions**. Set the value for the deploy context you intend to test. Environment changes require a new deploy. See [Netlify function environment variables](https://docs.netlify.com/build/functions/environment-variables/).
4. Deploy or redeploy. Use the Netlify site URL to open the app. A GitHub Pages upload or a static-only manual upload cannot run the serverless function. Opening `index.html` directly from disk is not the supported way to run this upgrade.
5. Check the deploy log: the `analyze` function should be included, along with a code-based rate-limit rule for its path. The rule requests six calls per IP/domain per 60 seconds. Enforcement is provided by Netlify after deployment and can have a brief counting delay; it is not a global quota or visitor authentication. See [Netlify rate limits](https://docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/).

After that setup, visitors never enter an API key: the function uses **your server environment variable automatically**. Without the server variable, extraction still works and analysis returns a configuration/unavailable message.

## AI connection and boundaries

The browser calls only `/.netlify/functions/analyze` on the same origin. Only the function calls:

```text
POST https://openrouter.ai/api/v1/chat/completions
Requested model: openrouter/free
```

The function always requests `openrouter/free`; there are no paid-model fallbacks or automatic retries. It also sets provider prompt/completion maximum prices to zero. OpenRouter's [free router](https://openrouter.ai/docs/guides/routing/routers/free-router) chooses an available free underlying model; availability, latency, and output quality vary. If a compatible free route is unavailable, the app shows an error. All visitors share your OpenRouter limits. This code does not promise that your chosen hosting plan has no usage charges.

The server independently validates the submitted text and selections, reconstructs excerpts from that text, and sends only those excerpts to the AI. It does not trust client-supplied prompts or quoted source material returned by the AI. Source text is labeled as untrusted data in a separate user message; fixed system instructions forbid following document commands, looking up authorities, and inventing missing context. These measures reduce prompt-injection risk but do not guarantee model behavior or legal accuracy. No tools or browsing are given to the model.

Server limits:

- 260,000 request bytes; 60,000 source-text characters.
- One to five distinct extracted citations, selected explicitly; extra request fields are rejected.
- At most three excerpts per citation, each no more than 760 characters.
- One upstream request, a 22-second abort timeout, and at most 1,600 generated tokens.
- At most 32,000 upstream response bytes; a complete, valid JSON analysis is required.
- One allowed role and a nonempty explanation of at most 700 characters per selected citation. Invalid, missing, duplicate, oversized, or truncated results fail safely.

Returned model content is displayed with `textContent`, never inserted as HTML. Upstream error bodies and exception details are not echoed or logged. The key is used only in the outbound authorization header; requests cannot change the endpoint or model. The app adds no document storage or application logging. Your text is sent to the function when analyzing; selected excerpts are forwarded to OpenRouter and its provider, whose data policies still apply. Use public/nonconfidential material for the assignment.

## Test without a key or live AI

From this project folder:

```sh
npm test
```

Or run Node directly:

```sh
node --test tests/*.test.mjs
```

These tests inject mocked responses and an explicit noncredential sentinel. They never read a real key or make an OpenRouter request. Interface tests use a minimal DOM double; they do not replace browser QA. See `TEST_RESULTS.md` for the actual results and the untested live/deployment checks.

For a browser preview of the full flow, still without a key:

```sh
npm run preview:mock
```

Open [the offline mock preview](http://127.0.0.1:8888). Click **Load sample passage**, **Extract citations**, then **Analyze citations**. An **OFFLINE MOCK PREVIEW** banner and **OFFLINE MOCK RESPONSE** text distinguish the fixed test results from real AI. This helper serves only an explicit list of public assets, binds to localhost, and always substitutes the OpenRouter call. It does not read `OPENROUTER_API_KEY`, even if that variable exists. Stop it with **Ctrl+C**. The helper is not deployed by Netlify.

## Live testing — only when you are ready

No live OpenRouter request was made while creating this project. To begin live testing yourself, deploy the project, set the server variable, and click **Analyze citations** on your Netlify site using the sample passage. That click will make one real OpenRouter request using your key. Confirm that two citations appear, each has one of the five tentative roles and a short explanation, and the original excerpts are visible. AI wording and classifications may vary; they are not fixed expected test values.

Also verify that the function is deployed, that missing-key and unavailable-service messages work, and that Netlify applied the rate-limit rule. A live key/deployment is needed to validate actual free-model compatibility, quotas, real response quality, deployed timeout behavior, and rate-limit enforcement. Do not paste a real key into the interface, test fixtures, logs, or repository.
