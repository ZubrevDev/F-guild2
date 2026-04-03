# F-Guild — Ralph Loop Prompt

You have superpowers. Use them.

## Workflow

1. Invoke `superpowers:subagent-driven-development` skill
2. Read `tasks.json` — it is your plan and task tracker
3. Read `progress.md` — understand what was done before
4. Pick ONE pending task with highest priority (critical > high > medium > low) whose ALL dependencies have status `done`
5. Dispatch a fresh subagent to implement the task per its `acceptance_criteria`
6. After implementation: dispatch spec reviewer subagent, then code quality reviewer subagent
7. Run all `test_steps` from the task — verify each passes
8. Git commit the implementation
9. Set task status to `done` in tasks.json
10. Log summary in progress.md
11. Git commit the status update

## Rules

- ONE task per iteration — do not batch
- Do NOT edit task definitions — only change `status` field
- Do NOT skip test_steps — all must pass before marking done
- Use `pnpm build` to verify no TypeScript/ESLint errors before committing
- Commit messages: English, imperative, <72 chars
- If a task cannot be completed, output `<promise>BLOCKED</promise>`

## Completion

When ALL tasks in tasks.json have status `done`:
<promise>COMPLETE</promise>
