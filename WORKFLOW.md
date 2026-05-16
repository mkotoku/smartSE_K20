# Ticket Workflow

This project uses a repeatable ticket loop:

1. Pick the next open GitHub issue.
2. Implement the requested change.
3. Verify the change locally.
4. Open a separate review session and review the implementation.
5. If verification or review finds problems, return to implementation.
6. If no problems remain, publish the result and move to the next issue.
7. Finish when there are no open issues.

## 1. Pick Ticket

- Read open issues from `mkotoku/smartSE_K20`.
- Select the oldest open issue unless the user specifies another one.
- Read the issue title, body, comments, and any linked context before editing.
- Restate the intended behavior in the working notes before implementation.

## 2. Implement

- Keep the change scoped to the selected issue.
- Preserve the direct-browser launch requirement: `index.html` must work from `file://`.
- Keep third-party runtime files local to the repository.
- Update controls, HUD text, README, and saved settings when behavior changes.
- Do not close the issue during implementation.

## 3. Verify

Run verification before review:

- Syntax-check JavaScript files with `node --check`.
- Confirm changed files are present and referenced correctly.
- For gameplay changes, verify the relevant state transitions and rules with a local smoke test where possible.
- If browser automation is available, reload `file:///C:/Users/waseda/Desktop/work/K20/ex10/index.html` and visually inspect the changed behavior.
- If verification fails, fix the issue and repeat verification.

## 4. Review In A New Session

Review must be performed in a separate session from implementation.

The review session should:

- Read the issue and the implementation diff.
- Focus on bugs, regressions, missed edge cases, and missing verification.
- Check whether the implemented behavior satisfies the issue.
- Return either `approved` or a concrete list of required fixes.

If the review finds any problem:

- Return to the implementation session.
- Apply the required fixes.
- Repeat verification.
- Start another separate review session.

## 5. Publish Result

Only publish when verification passes and the separate review session approves.

- Commit the final change to `main`.
- Comment on the issue with:
  - What changed
  - How it was verified
  - Review result
  - Commit URL
- Close the issue as completed.
- Move to the next open issue.

## 6. Completion

When no open issues remain:

- Report that all tickets are complete.
- Include the latest commit URL.
- Include any known limitations, such as unavailable browser automation.

## 7. Local Tooling Notes

This Windows/Codex workspace has a few local tool paths that may not be visible in a fresh shell until the app or terminal is restarted.

- GitHub CLI is installed at `C:\Program Files\GitHub CLI\gh.exe`.
- Git is installed at `C:\Program Files\Git\cmd\git.exe`.
- Both `C:\Program Files\GitHub CLI` and `C:\Program Files\Git\cmd` are added to the user `Path`.
- If `gh` or `git` is still not found in the current process, call the full executable path above or refresh the shell environment before continuing.
- PowerShell may block `npm.ps1`; use `npm.cmd` and `npx.cmd` instead of bare `npm` or `npx`.
- Playwright is available through the global Playwright CLI package under `C:\Users\waseda\AppData\Roaming\npm\node_modules\@playwright\cli\node_modules`.
- The user `NODE_PATH` is set to that Playwright `node_modules` directory so Node smoke tests can use `require("playwright")`.
- Playwright-managed Chromium is installed in `%LOCALAPPDATA%\ms-playwright` and should launch with `chromium.launch({ headless: true })`.
- If the managed browser cache is missing after an update, run:

```powershell
node "C:\Users\waseda\AppData\Roaming\npm\node_modules\@playwright\cli\node_modules\playwright\cli.js" install chromium
```

- Existing desktop browsers are also usable with Playwright fallbacks:

```js
await chromium.launch({ channel: "chrome", headless: true });
await chromium.launch({ channel: "msedge", headless: true });
```

Recommended local smoke test pattern:

```powershell
$env:NODE_PATH = "C:\Users\waseda\AppData\Roaming\npm\node_modules\@playwright\cli\node_modules"
@'
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("file:///C:/Users/waseda/Desktop/work/K20/ex10/index.html", { waitUntil: "load" });
  await page.getByRole("button", { name: "Play" }).click();
  await page.waitForTimeout(1000);
  const state = await page.evaluate(() => ({
    title: document.title,
    hudActive: document.getElementById("hud").classList.contains("is-active"),
    camera: document.getElementById("cameraReadout").textContent,
    timer: document.getElementById("timer").textContent
  }));
  await browser.close();
  console.log(JSON.stringify({ state, errors }, null, 2));
})().catch(error => { console.error(error); process.exit(1); });
'@ | node -
```
