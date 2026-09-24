import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PI_DIR = "C:/Users/cuong/AppData/Local/Volta/tools/image/packages/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-coding-agent";

const { createJiti } = await import(pathToFileURL(path.join(PI_DIR, "node_modules/jiti/lib/jiti-static.mjs")).href);
const jiti = createJiti(import.meta.url, {
  alias: {
    "@earendil-works/pi-coding-agent": path.join(PI_DIR, "dist/index.js"),
    "@earendil-works/pi-tui": path.join(PI_DIR, "node_modules/@earendil-works/pi-tui/dist/index.js"),
  },
});

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.join(here, "../npm/node_modules/@juicesharp/rpiv-ask-user-question");
const mod = await jiti.import(path.join(pkgDir, "ask-user-question.ts"));
const { answeredRows, buildItemsForQuestion, registerAskUserQuestionTool } = mod;
const { buildQuestionnaireResponse } = await jiti.import(path.join(pkgDir, "tool/response-envelope.ts"));
const { reduce } = await jiti.import(path.join(pkgDir, "state/state-reducer.ts"));
const { routeKey } = await jiti.import(path.join(pkgDir, "state/key-router.ts"));
const { QuestionTabStrategy, SubmitTabStrategy, buildHintText } = await jiti.import(
	path.join(pkgDir, "view/tab-content-strategy.ts"),
);
const { TabBar } = await jiti.import(path.join(pkgDir, "view/components/tab-bar.ts"));
const { SubmitPicker } = await jiti.import(path.join(pkgDir, "view/components/submit-picker.ts"));
const { MultiSelectView } = await jiti.import(path.join(pkgDir, "view/components/multi-select-view.ts"));

const tagged = { fg: (role, text) => `<${role}>${text}</${role}>` };
const plain = { fg: (_role, text) => text };
const render = (component) => component.render(200).map((line) => line.trimEnd()).join("\n");

let tool;
registerAskUserQuestionTool({ registerTool: (definition) => (tool = definition), on: () => {} });
assert.ok(tool, "tool registered");
assert.equal(tool.renderShell, "self");
assert.equal(render(tool.renderCall({}, plain, {})), "");
assert.equal(render(tool.renderResult({ content: [], details: {} }, { expanded: false, isPartial: true }, plain, {})), "");
console.log("PASS: nothing drawn while the questionnaire is open");

{
  const details = { answers: [{ questionIndex: 0, question: "Pick one", kind: "option", answer: "Alpha" }], cancelled: false };
  const rows = answeredRows(details, tagged);
  assert.deepEqual(rows, ["<muted>● </muted>User answered Claude's questions:", "<muted>  ⎿ \u00a0· Pick one → Alpha</muted>"]);
  console.log("PASS: one answer ->", JSON.stringify(rows));
}
{
  const details = {
    answers: [
      { questionIndex: 0, question: "Sheet?", kind: "custom", answer: "https://x" },
      { questionIndex: 1, question: "Trigger?", kind: "multi", selected: ["Scheduled", "Manual"] },
    ],
    cancelled: false,
  };
  const rows = render(tool.renderResult({ content: [], details }, { expanded: false, isPartial: false }, plain, {}));
  assert.equal(rows, "● User answered Claude's questions:\n  ⎿ \u00a0· Sheet? → https://x\n     · Trigger? → Scheduled, Manual");
  console.log("PASS: several answers ->", JSON.stringify(rows));
}
{
  const rows = answeredRows({ answers: [], cancelled: true }, plain);
  assert.deepEqual(rows, ["● User declined to answer questions"]);
  assert.deepEqual(answeredRows(undefined, plain), ["● User declined to answer questions"]);
  console.log("PASS: declined ->", JSON.stringify(rows));
}
{
  const malformed = [{ question: "Which colour?" }, { header: "no question" }, { question: "Pick", options: [{ label: "A" }, { label: "B" }] }];
  const rows = answeredRows(undefined, plain, malformed);
  assert.equal(rows.length, 2, "questions the model sent without options are skipped instead of crashing render");
  assert.ok(rows[1].includes("· Pick (A / B)"));
  console.log("PASS: malformed question arguments never crash the result row ->", JSON.stringify(rows));
}
{
  const ROLES = { muted: "\x1b[38;2;153;153;153m", text: "\x1b[38;2;255;255;255m" };
  const RESET = "\x1b[0m";
  const theme = {
    fg: (role, text) => `${ROLES[role] ?? ""}${text}${RESET}`,
    bg: (_role, text) => text,
    bold: (text) => `\x1b[1m${text}${RESET}`,
  };
  const tui = { terminal: { rows: 40, columns: 80 }, requestRender: () => {} };
  const keybindings = { matches: () => false };
  const sessionMod = await jiti.import(path.join(pkgDir, "state/questionnaire-session.ts"));
  const { QuestionnaireSession } = sessionMod;
  const typed = {
    questions: [
      {
        question: "Which colour do you prefer?",
        header: "Colour",
        multiSelect: false,
        options: [
          { label: "Red", description: "Warm" },
          { label: "Blue", description: "Cool" },
        ],
      },
    ],
  };
  const itemsByTab = typed.questions.map((q) => buildItemsForQuestion(q));
  const session = new QuestionnaireSession({
    tui,
    theme,
    params: typed,
    itemsByTab,
    done: () => {},
    keybindings,
    editInput: async () => undefined,
    collapseKey: "off",
    canReopenWhileHidden: false,
  });
  const lines = session.component.render(80).map((l) => l.trimEnd());
  assert.ok(lines[0].startsWith("\x1b[38;2;153;153;153m─"), "top rule is muted, not accent");
  assert.equal(lines[1], "\x1b[48;2;153;204;255m\x1b[38;2;0;0;0m ☐ Colour \x1b[0m", "chip has a checkbox glyph on the accent background, no extra margin before it");
  assert.equal(lines[3], "\x1b[38;2;255;255;255m\x1b[1mWhich colour do you prefer?\x1b[0m\x1b[0m", "question text is bold white at column 0");
  assert.equal(lines[5], "\x1b[38;2;153;204;255m❯ \x1b[0m\x1b[38;2;153;153;153m1. \x1b[0m\x1b[38;2;153;204;255mRed\x1b[0m", "selected option: accent pointer, muted number, accent label");
  assert.equal(lines[6], "     \x1b[38;2;153;153;153mWarm\x1b[0m", "description sits five columns in, muted");
  assert.equal(lines[7], "  \x1b[38;2;153;153;153m2. \x1b[0mBlue", "unselected option keeps the label plain, only the number muted");
  assert.equal(lines[9], "  \x1b[38;2;153;153;153m3. \x1b[0m\x1b[38;2;153;153;153mType something.\x1b[0m", "the custom-answer row is muted even at rest");
  assert.ok(lines[10].startsWith("\x1b[38;2;153;153;153m─"), "second rule is muted too");
  assert.equal(lines[11], "  4. Chat about this", "unfocused Chat about this row is plain (no colour), below the second rule");
  const footer = lines[lines.length - 1];
  assert.equal(footer, "\x1b[38;2;153;153;153mEnter to select · ↑/↓ to navigate · Esc to cancel\x1b[0m", "footer matches Claude's wording, no notes or collapse hint, column 0");
  console.log("PASS: single-question dialog matches Claude's measured rows");
}

{
  const question = { question: "Pick one", header: "Pick", multiSelect: false, options: [{ label: "Red" }, { label: "Blue" }] };
  const items = buildItemsForQuestion(question);
  assert.equal(items[items.length - 1].kind, "chat");
  assert.equal(items[items.length - 1].label, "Chat about this");
  const state = {
    currentTab: 0,
    optionIndex: items.length - 1,
    inputMode: false,
    notesVisible: false,
    answers: new Map(),
    multiSelectChecked: new Set(),
    customDraftsByTab: new Map(),
    notesByTab: new Map(),
    submitChoiceIndex: 0,
    notesDraft: "",
    collapsed: false,
  };
  const kb = { matches: (data, name) => name === "tui.select.confirm" && data === "confirm" };
  const runtime = {
    keybindings: kb,
    inputBuffer: "",
    canMoveInputUp: false,
    canMoveInputDown: false,
    questions: [question],
    isMulti: false,
    currentItem: items[items.length - 1],
    items,
    collapseKey: "off",
  };
  const action = routeKey("confirm", state, runtime);
  assert.deepEqual(action, { kind: "chat" });
  const { effects } = reduce(state, action, { questions: [question], itemsByTab: [items] });
  const result = effects[0].result;
  assert.deepEqual(result, { answers: [], cancelled: true, followUp: true });
  const response = buildQuestionnaireResponse(result, { questions: [question] });
  assert.equal(
    response.content[0].text,
    "The user asked for more questions before answering. Call ask_user_question again now with further questions about this decision (do not repeat these); do not proceed with the task yet.",
  );
  assert.deepEqual(answeredRows(result, plain), ["● User declined to answer questions"]);
  console.log("PASS: picking Chat about this with no prior answers ->", JSON.stringify(response.content[0].text));
}
{
  const q0 = { question: "Sheet?", header: "Sheet", multiSelect: false, options: [{ label: "A" }, { label: "B" }] };
  const q1 = { question: "Trigger?", header: "Trigger", multiSelect: false, options: [{ label: "Scheduled" }, { label: "Manual" }] };
  const answers = new Map([[0, { questionIndex: 0, question: "Sheet?", kind: "option", answer: "A" }]]);
  const result = { answers: [...answers.values()], cancelled: true, followUp: true };
  const response = buildQuestionnaireResponse(result, { questions: [q0, q1] });
  assert.equal(
    response.content[0].text,
    'The user asked for more questions before you proceed. So far they answered: "Sheet?"="A". Call ask_user_question again with follow-up questions that build on these answers (do not repeat these); do not start the task yet.',
  );
  assert.deepEqual(answeredRows(result, plain), ["● User declined to answer questions"]);
  console.log("PASS: picking Chat about this after answering one question ->", JSON.stringify(response.content[0].text));
}
{
  const ROLES = { muted: "\x1b[38;2;153;153;153m", text: "\x1b[38;2;255;255;255m", success: "\x1b[32m" };
  const RESET = "\x1b[0m";
  const theme = {
    fg: (role, text) => `${ROLES[role] ?? ""}${text}${RESET}`,
    bg: (_role, text) => text,
    bold: (text) => `\x1b[1m${text}${RESET}`,
  };
  const question = { question: "Pick one", header: "Pick", multiSelect: false, options: [{ label: "Red" }, { label: "Blue" }] };
  const strategy = new QuestionTabStrategy({
    theme,
    questions: [question],
    getPreviewPane: () => ({ focusedItemRowRange: () => [0, 1] }),
    tabsByIndex: [{ multiSelect: undefined }],
    notesInput: { render: () => [] },
    isMulti: false,
    getCurrentBodyHeight: () => 0,
    collapseKey: "off",
  });
  const restingState = { currentTab: 0, optionIndex: 0, notesVisible: false, inputMode: false };
  const restingChatRow = strategy.footerRows(restingState)[0];
  assert.equal(restingChatRow.render(80)[0].trimEnd(), "  4. Chat about this");
  const focusedState = { currentTab: 0, optionIndex: question.options.length + 1, notesVisible: false, inputMode: false };
  const focusedChatRow = strategy.footerRows(focusedState)[0];
  assert.equal(
    focusedChatRow.render(80)[0].trimEnd(),
    "\x1b[38;2;153;204;255m❯ \x1b[0m\x1b[38;2;153;204;255m4. Chat about this\x1b[0m",
  );
  const multiQuestion = { question: "Pick many", header: "Pick", multiSelect: true, options: [{ label: "Red" }, { label: "Blue" }] };
  const multiStrategy = new QuestionTabStrategy({
    theme,
    questions: [multiQuestion],
    getPreviewPane: () => ({ focusedItemRowRange: () => [0, 1] }),
    tabsByIndex: [{ multiSelect: { focusedItemRowRange: () => [0, 1] } }],
    notesInput: { render: () => [] },
    isMulti: false,
    getCurrentBodyHeight: () => 0,
    collapseKey: "off",
  });
  const multiRows = multiStrategy.footerRows(restingState);
  assert.equal(multiRows.length, 3);
  assert.equal(multiRows[0].render(80)[0].trimEnd(), "  4. Chat about this");
  console.log("PASS: Chat about this row (resting, focused, and present on multiSelect too)");
}
{
  const ROLES = { muted: "\x1b[38;2;153;153;153m", text: "\x1b[38;2;255;255;255m" };
  const RESET = "\x1b[0m";
  const theme = { fg: (role, text) => `${ROLES[role] ?? ""}${text}${RESET}` };
  const tabBar = new TabBar(theme);
  tabBar.setProps({
    tabs: [
      { label: "Colour", answered: true, active: true },
      { label: "Size", answered: false, active: false },
    ],
    submit: { active: false, allAnswered: false },
  });
  const [line, blank] = tabBar.render(120);
  assert.equal(blank, "");
  assert.equal(
    line,
    "\x1b[38;2;153;153;153m← \x1b[0m" +
      "\x1b[48;2;153;204;255m\x1b[38;2;0;0;0m ☒ Colour \x1b[0m" +
      " ☐ Size " +
      " ✔ Submit " +
      " →",
    "active tab is the only chip on the accent chip background; inactive chips, an inactive submit tab, and a non-dimmed arrow stay plain",
  );
  tabBar.setProps({
    tabs: [
      { label: "Colour", answered: true, active: false },
      { label: "Size", answered: false, active: false },
    ],
    submit: { active: true, allAnswered: false },
  });
  const [submitLine] = tabBar.render(120);
  assert.equal(
    submitLine,
    "← " +
      " ☒ Colour " +
      " ☐ Size " +
      "\x1b[48;2;153;204;255m\x1b[38;2;0;0;0m ✔ Submit \x1b[0m" +
      "\x1b[38;2;153;153;153m →\x1b[0m",
    "on the Submit tab the left arrow stays plain (more tabs behind) and the right arrow dims (nothing beyond Submit)",
  );
  console.log("PASS: tab strip glyphs, chip colouring, and boundary-dimmed arrows match Claude's sS component");
}
{
  const ROLES = { muted: "\x1b[38;2;153;153;153m", text: "\x1b[38;2;255;255;255m", borderAccent: "\x1b[38;2;51;153;255m" };
  const RESET = "\x1b[0m";
  const theme = {
    fg: (role, text) => `${ROLES[role] ?? ""}${text}${RESET}`,
    bg: (_role, text) => text,
    bold: (text) => `\x1b[1m${text}${RESET}`,
  };
  const question = { question: "Pick many", header: "Pick", multiSelect: true, options: [{ label: "Red" }, { label: "Blue" }] };
  const view = new MultiSelectView(theme, question);
  view.setProps({
    rows: [
      { checked: false, active: true },
      { checked: true, active: false },
    ],
    other: { active: false, inputMode: false, inputBuffer: "", inputCursorOffset: undefined },
    nextActive: false,
    nextLabel: "Next",
  });
  const lines = view.render(80).map((l) => l.trimEnd());
  assert.equal(
    lines[0],
    "\x1b[38;2;153;204;255m❯ \x1b[0m\x1b[38;2;153;153;153m1. \x1b[0m[ ] \x1b[38;2;153;204;255mRed\x1b[0m",
    "focused option: numbered, uncoloured unchecked box, accent pointer+label (not bold)",
  );
  assert.equal(
    lines[1],
    "  \x1b[38;2;153;153;153m2. \x1b[0m\x1b[38;2;51;153;255m[✔]\x1b[0m Blue",
    "unfocused checked option: numbered, borderAccent-coloured [✔] box",
  );
  assert.equal(
    lines[2],
    "  \x1b[38;2;153;153;153m3. \x1b[0m[ ] \x1b[38;2;153;153;153mType something\x1b[0m",
    "multiSelect custom row has no trailing period and is muted even at rest",
  );
  assert.equal(
    lines[3],
    "     \x1b[1mNext\x1b[0m",
    "Next row is bold, plain (uncoloured) when not focused, indented under the number column",
  );
  console.log("PASS: multiSelect rows are numbered, use [ ]/[✔] boxes, and an unpunctuated custom row");
}
{
  const ROLES = { muted: "\x1b[38;2;153;153;153m", borderAccent: "\x1b[38;2;51;153;255m" };
  const RESET = "\x1b[0m";
  const theme = {
    fg: (role, text) => `${ROLES[role] ?? ""}${text}${RESET}`,
    bg: (_role, text) => text,
    bold: (text) => `\x1b[1m${text}${RESET}`,
  };
  const question = {
    question: "Which fruits do you like?",
    header: "Fruits",
    multiSelect: true,
    options: [
      { label: "Apple", description: "A common red or green fruit" },
      { label: "Banana", description: "A yellow tropical fruit" },
      { label: "Cherry", description: "A small red fruit" },
    ],
  };
  const view = new MultiSelectView(theme, question);
  view.setProps({
    rows: [
      { checked: true, active: true },
      { checked: false, active: false },
      { checked: false, active: false },
    ],
    other: { active: false, inputMode: false, inputBuffer: "", inputCursorOffset: undefined },
    nextActive: false,
    nextLabel: "Submit",
  });
  const lines = view.render(80).map((l) => l.trimEnd());
  assert.equal(
    lines[1],
    `         ${ROLES.muted}A common red or green fruit${RESET}`,
    "description continuation indents under the label, past pointer+number+box+gap (9 columns here), matching Claude's live capture",
  );
  console.log("PASS: multiSelect description continuation aligns under the label, not a fixed 2 columns");
}
{
  const ROLES = { muted: "\x1b[38;2;153;153;153m", text: "\x1b[38;2;255;255;255m" };
  const RESET = "\x1b[0m";
  const theme = { fg: (role, text) => `${ROLES[role] ?? ""}${text}${RESET}`, bold: (text) => `\x1b[1m${text}${RESET}` };
  const picker = new SubmitPicker(theme);
  picker.setProps({ rows: [{ active: true }, { active: false }] });
  const lines = picker.render(80);
  assert.equal(
    lines[0],
    "\x1b[38;2;153;204;255m❯ \x1b[0m\x1b[38;2;153;153;153m1. \x1b[0m\x1b[38;2;153;204;255mSubmit answers\x1b[0m",
    "focused Submit answers: raw accent pointer+label (not bold), muted number",
  );
  assert.equal(lines[1], "  \x1b[38;2;153;153;153m2. \x1b[0mCancel", "unfocused Cancel: muted number, unstyled label");
  console.log("PASS: review screen buttons are '1. Submit answers' / '2. Cancel', numbers muted, no bold");
}
{
  const ROLES = { muted: "\x1b[38;2;153;153;153m", text: "\x1b[38;2;255;255;255m", borderAccent: "\x1b[38;2;51;153;255m", dim: "\x1b[2m" };
  const RESET = "\x1b[0m";
  const theme = { fg: (role, text) => `${ROLES[role] ?? ""}${text}${RESET}` };
  const q0 = { question: "Sheet?", header: "Sheet", multiSelect: false, options: [{ label: "A" }, { label: "B" }] };
  const strategy = new SubmitTabStrategy({ theme, questions: [q0], submitPicker: undefined, notesInput: { render: () => [] } });
  const state = {
    answers: new Map([[0, { questionIndex: 0, question: "Sheet?", kind: "option", answer: "A" }]]),
    notesByTab: new Map(),
    notesVisible: false,
  };
  const lines = strategy.bodyComponent(state).render(80).map((l) => l.trimEnd());
  assert.equal(lines[0], " ● Sheet?", "review row shows the full question text, unstyled, one leading space");
  assert.equal(lines[1], "   \x1b[38;2;51;153;255m→ A\x1b[0m", "review row's arrow+answer are borderAccent-coloured");
  console.log("PASS: review screen answer rows show the full question, borderAccent arrow+answer, matching Claude");
}
{
  const question = { question: "Pick one", header: "Pick", multiSelect: false, options: [{ label: "Red" }, { label: "Blue" }] };
  const restingState = { notesVisible: false, inputMode: false };
  assert.equal(
    buildHintText(question, false, restingState, "off"),
    "Enter to select · ↑/↓ to navigate · Esc to cancel",
    "single-question footer keeps ↑/↓ wording",
  );
  assert.equal(
    buildHintText(question, true, restingState, "off"),
    "Enter to select · Tab/Arrow keys to navigate · Esc to cancel",
    "multi-question footer collapses nav+tab into one Claude-measured phrase",
  );
  console.log("PASS: buildHintText matches Claude's single-phrase 'Tab/Arrow keys to navigate' wording in multi-question mode");
}
{
  const question = { question: "Pick one", header: "Pick", multiSelect: false, options: [{ label: "Red" }, { label: "Blue" }] };
  const restingState = { notesVisible: false, inputMode: false, optionIndex: 0 };
  assert.equal(
    buildHintText(question, false, restingState, "off", "Notepad"),
    "Enter to select · ↑/↓ to navigate · Esc to cancel",
    "no ctrl+g hint while focused on a regular option, even with an editor configured",
  );
  const onOtherState = { ...restingState, optionIndex: question.options.length };
  assert.equal(
    buildHintText(question, false, onOtherState, "off", "Notepad"),
    "Enter to select · ↑/↓ to navigate · ctrl+g to edit in Notepad · Esc to cancel",
    "ctrl+g hint appears once focus reaches the Type something. row",
  );
  const onChatState = { ...restingState, optionIndex: question.options.length + 1 };
  assert.equal(
    buildHintText(question, false, onChatState, "off", "Notepad"),
    "Enter to select · ↑/↓ to navigate · ctrl+g to edit in Notepad · Esc to cancel",
    "ctrl+g hint stays sticky on Chat about this, past the Type something. row",
  );
  assert.equal(
    buildHintText(question, false, onChatState, "off", undefined),
    "Enter to select · ↑/↓ to navigate · Esc to cancel",
    "no ctrl+g hint when no external editor is configured, even past Type something.",
  );
  console.log("PASS: ctrl+g hint matches Claude's sticky trigger (at or past the Type something. row)");
}
{
  const questions = [
    { question: "Which colour do you prefer?", header: "Colour", multiSelect: false, options: [{ label: "Red" }, { label: "Blue" }] },
  ];
  const rows = answeredRows({ answers: [], cancelled: true }, plain, questions);
  assert.deepEqual(
    rows,
    ["● User declined to answer questions", "  ⎿  · Which colour do you prefer? (Red / Blue)"],
    "declined result lists each asked question with its options in parens, matching Claude's live capture",
  );
  const rendered = render(
    tool.renderResult(
      { content: [], details: { answers: [], cancelled: true } },
      { expanded: false, isPartial: false },
      plain,
      { args: { questions } },
    ),
  );
  assert.equal(
    rendered,
    "● User declined to answer questions\n  ⎿  · Which colour do you prefer? (Red / Blue)",
    "renderResult threads context.args.questions into the decline row",
  );
  assert.deepEqual(answeredRows({ answers: [], cancelled: true }, plain), ["● User declined to answer questions"], "no questions arg -> bare decline line, unchanged");
  console.log("PASS: decline row lists per-question options, matching Claude");
}

{
  const { resolveAfk, focusOf, schemaRejectedRows } = mod;
  const { afkStep, afkRow } = await jiti.import(path.join(pkgDir, "state/questionnaire-session.ts"));
  assert.equal(resolveAfk({}, undefined), undefined, "askUserQuestionTimeout unset: no auto-continue (Claude's default is never)");
  assert.equal(resolveAfk({}, "never"), undefined, "never: no auto-continue");
  assert.equal(resolveAfk({}, "toString"), undefined, "only Claude's four enum values count");
  assert.deepEqual(resolveAfk({}, "60s"), { timeoutMs: 60_000, countdownMs: 20_000 }, "60s: Claude's Q2n 60000 with the NYt 20000 countdown");
  assert.deepEqual(resolveAfk({}, "5m"), { timeoutMs: 300_000, countdownMs: 20_000 }, "5m");
  assert.deepEqual(
    resolveAfk({ CLAUDE_AFK_TIMEOUT_MS: "12000", CLAUDE_AFK_COUNTDOWN_MS: "8000" }, undefined),
    { timeoutMs: 12_000, countdownMs: 8_000 },
    "Claude's own env knobs turn it on and set both times",
  );
  assert.deepEqual(resolveAfk({ CLAUDE_AFK_TIMEOUT_MS: "5000" }, "60s"), { timeoutMs: 5_000, countdownMs: 5_000 }, "the countdown never exceeds the timeout");
  console.log("PASS: auto-continue timeout resolves like Claude 2.1.280 (askUserQuestionTimeout, CLAUDE_AFK_*)");

  const afk = { timeoutMs: 12_000, countdownMs: 8_000 };
  assert.deepEqual(afkStep(afk, 0, 3_000, 0, undefined), { start: 0, remainingSeconds: 12, fire: false }, "before the countdown window the full timeout shows");
  assert.deepEqual(afkStep(afk, 0, 6_000, 0, undefined), { start: 0, remainingSeconds: 6, fire: false }, "inside it the seconds left count down (measured: auto-continue in 6s at 6 s of 12)");
  assert.deepEqual(afkStep(afk, 0, 12_000, 0, undefined), { start: 0, remainingSeconds: 0, fire: true }, "at the timeout it fires");
  assert.deepEqual(afkStep(afk, 0, 12_000, 10_000, undefined), { start: 0, remainingSeconds: 12, fire: false }, "a key pressed since restarts the idle time");
  assert.deepEqual(afkStep(afk, 0, 20_000, 0, true), { start: 20_000, remainingSeconds: 12, fire: false }, "a focused terminal holds the clock at zero");
  assert.deepEqual(afkStep(afk, 0, 20_000, 0, false), { start: 0, remainingSeconds: 0, fire: true }, "an unfocused terminal lets it run");
  assert.equal(afkRow(afk, 12, 132, (t) => t), "", "no countdown text outside the window, the row stays blank");
  const row = afkRow(afk, 6, 132, (t) => `<muted>${t}</muted>`);
  assert.equal(row, `${" ".repeat(95)}<muted>auto-continue in 6s · any key to stay</muted>`, "right-aligned to the last column, as measured at 132 columns");
  console.log("PASS: AFK countdown follows Claude's Gue hook");

  const questions = [{ question: "Which colour do you prefer?", header: "Colour", multiSelect: false, options: [{ label: "Red" }, { label: "Blue" }] }];
  assert.deepEqual(
    answeredRows({ answers: [], cancelled: false, afkTimeoutMs: 12_000 }, tagged, questions),
    [
      "<muted>● </muted>Claude asked:",
      "<muted>  ⎿  · Which colour do you prefer? (Red / Blue)</muted>",
      "     <muted>● No response after 12s — continued without an answer</muted>",
    ],
    "AFK with nothing picked matches the measured Claude rows",
  );
  const fruits = { questionIndex: 1, question: "Which fruits do you like?", kind: "multi", answer: null, selected: ["Apple"] };
  assert.deepEqual(
    answeredRows({ answers: [fruits], cancelled: false, afkTimeoutMs: 60_000 }, plain, questions),
    ["● Claude asked:", "  ⎿  · Which fruits do you like? → Apple", "     ● No response after 60s — continued with the answers selected so far"],
    "AFK with a checked box lists it, as Claude did with Apple checked",
  );
  const nothing = buildQuestionnaireResponse({ answers: [], cancelled: false, afkTimeoutMs: 60_000 }, { questions });
  assert.equal(
    nothing.content[0].text,
    "No response after 60s — the user may be away from keyboard. Proceed using your best judgment based on the context so far; you can re-ask this question later if it's still relevant.",
    "the model reads Claude's own AFK text",
  );
  const some = buildQuestionnaireResponse({ answers: [fruits], cancelled: false, afkTimeoutMs: 60_000 }, { questions });
  assert.ok(some.content[0].text.endsWith('\nBefore going idle the user had selected: "Which fruits do you like?"="Apple".'), "and the picks made before going idle");

  const multi = [questions[0], { question: "Which fruits do you like?", header: "Fruits", multiSelect: true, options: [{ label: "Apple" }, { label: "Banana" }] }];
  const state = {
    currentTab: 1, optionIndex: 0, inputMode: false, notesVisible: false, answers: new Map(), multiSelectChecked: new Set([0]),
    customDraftsByTab: new Map(), notesByTab: new Map(), submitChoiceIndex: 0, notesDraft: "", collapsed: false,
  };
  const timedOut = reduce(state, { kind: "afk_timeout", timeoutMs: 60_000 }, { questions: multi, itemsByTab: [[], []] });
  assert.deepEqual(timedOut.effects[0].result.answers.map((a) => a.selected), [["Apple"]], "a checked but unconfirmed box counts as selected so far");
  assert.equal(timedOut.effects[0].result.afkTimeoutMs, 60_000);
  assert.equal(timedOut.effects[0].result.cancelled, false);

  assert.equal(focusOf("\x1b[I"), true);
  assert.equal(focusOf("\x1b[O"), false);
  assert.equal(focusOf("a"), undefined, "other input leaves the focus state alone");
  console.log("PASS: AFK result rows, model text and reducer match Claude");

  assert.deepEqual(schemaRejectedRows(tagged), ["<muted>  ⎿  </muted><error>Invalid tool parameters</error>"], "Claude's wp: an InputValidationError reads Invalid tool parameters, ff6666 under a 999999 elbow");
  const rejected = render(
    tool.renderResult(
      { content: [{ type: "text", text: 'Validation failed for tool "ask_user_question":\n  - questions.1.options.0.description: must have required properties description' }], details: {} },
      { expanded: false, isPartial: false },
      plain,
      { args: { questions }, isError: true },
    ),
  );
  assert.equal(rejected, "  ⎿  Invalid tool parameters", "a schema-rejected call draws Claude's row, not the decline rows");
  console.log("PASS: schema rejection renders like Claude's InputValidationError");
}

console.log("ok - rpiv-ask-user-question rows");
