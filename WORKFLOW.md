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
