You have superpowers. Use the Skill tool to invoke superpowers:subagent-driven-development skill.

Read tasks.json and progress.md to understand current state.

Execute pending tasks using subagent-driven development:
- Pick tasks in priority order (critical > high > medium > low)
- Only pick tasks whose dependencies are all "done"
- For each task: implement -> spec review -> code quality review -> commit
- Update task status to "done" in tasks.json after passing reviews
- Log progress in progress.md

When ALL tasks have status "done", output: <promise>COMPLETE</promise>
If blocked on all remaining tasks, output: <promise>BLOCKED</promise>
