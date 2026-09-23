# UI parity task

Do these steps in order. One tool call per step, nothing else: no other tool calls, no questions, no text between steps.

1. Read the file notes.txt.
2. Search the src folder for the text "export function".
3. Run this shell command, with the description "List source files": ls src
4. Run this shell command, with the description "Print a marker": echo parity-ok
5. Run this shell command, with the description "List missing folder": ls ./missing-folder
6. In src/app.ts, replace `return a + b;` with `return a - b;`.
7. Create the file summary.md containing exactly these three lines:

   # Summary
   - alpha
   - beta

8. Finally reply with exactly the markdown below, and nothing else:

## Result

The run **finished**. Touched `src/app.ts` and `summary.md`.

- edit applied
- file created

| Step | State |
| --- | --- |
| edit | done |
| write | done |
