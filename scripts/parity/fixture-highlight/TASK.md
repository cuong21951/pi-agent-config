# Highlight parity task

Do these steps in order. One tool call per step, nothing else: no other tool calls, no questions, no text between steps.

1. Read the file src/shapes.ts.
2. Read the file src/greet.py.
3. In src/shapes.ts, replace `return PI * this.radius ** 2;` with `return PI * this.radius * this.radius;`.
4. In src/greet.py, replace `return f"Hello, {self.name}! (#{GREETING_COUNT})"` with `return f"Hi, {self.name}! (#{GREETING_COUNT})"`.
5. Create the file src/constants.ts containing exactly these two lines:

   export const MAX_RETRIES = 3;
   export const APP_NAME = "shapes-demo";

6. Finally reply with exactly this text, and nothing else: Done.
