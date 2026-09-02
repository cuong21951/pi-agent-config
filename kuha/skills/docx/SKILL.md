---
name: docx
description: "Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx files) or Word templates (.dotx files). Triggers include: any mention of 'Word doc', 'word document', '.docx', '.dotx', or requests to produce professional documents with formatting like tables of contents, headings, page numbers, or letterheads. Also use when extracting or reorganizing content from .docx or .dotx files, inserting or replacing images in documents, performing find-and-replace in Word files, working with tracked changes or comments, or converting content into a polished Word document. If the user asks for a 'report', 'memo', 'letter', 'template', or similar deliverable as a Word or .docx file, use this skill. Do NOT use for PDFs, spreadsheets, Google Docs, or general coding tasks unrelated to document generation."
license: Proprietary. LICENSE.txt has complete terms
---

# DOCX creation, editing, and analysis

## Ghi chú Windows / macOS (Kuha)

Trên Windows dùng `py -3.12`; trên macOS/Linux dùng `python3`. Ghi chú dưới đây viết lệnh theo dạng `python3 {baseDir}/scripts/<name>.py ...` — trên Windows (kể cả trong Git Bash, nơi `python3` có thể chưa cài), thay bằng `py -3.12 {baseDir}/scripts/<name>.py ...`.

- Run every script here as `python3 {baseDir}/scripts/<name>.py ...` (Windows: `py -3.12 ...`). Confirmed pure-Python and cross-platform-safe: `merge_runs.py`, `comment.py`, `office/validate.py` (no LibreOffice needed for validation).
- `scripts/accept_changes.py` và các script dùng `office/soffice.py` chạy được trên cả Windows và macOS: bản Kuha đã vá `soffice.py` để bỏ bước dò socket Linux và tự tìm soffice ở các vị trí thường gặp (Windows: `C:\Program Files\LibreOffice\program\soffice.exe`; macOS: `/Applications/LibreOffice.app/Contents/MacOS/soffice`). Cần cài LibreOffice (Windows: `winget install TheDocumentFoundation.LibreOffice`; macOS: `brew install --cask libreoffice`).
- **No `zip`/`unzip` CLI on plain Windows** (macOS/Linux ship both; Git Bash on Windows does have `unzip`, but not `zip`). Pack step on Windows: `py -3.12 -c "import shutil,os; os.chdir('unpacked'); shutil.make_archive('../out','zip','.'); os.replace('../out.zip','../out.docx')"`. Unpack: `py -3.12 -c "import zipfile; zipfile.ZipFile('doc.docx').extractall('unpacked')"`.
- **LibreOffice on Windows** is already installed at `C:\Program Files\LibreOffice\program\soffice.exe` (needed for the "Verify the output" PDF render and for legacy `.doc` conversion). Otherwise: `winget install TheDocumentFoundation.LibreOffice` (Windows) or `brew install --cask libreoffice` (macOS).
- **`pdftoppm` (Poppler) is not installed** — the "render and look at it" step needs a substitute: `python3 -m pip install pymupdf` (Windows: `py -3.12 -m pip install pymupdf`), then render pages with `fitz.open("output.pdf")`, or open the LibreOffice-converted PDF directly in a viewer. macOS: `brew install poppler` also gets you real `pdftoppm`.
- **`pandoc` is not installed** — the "Read content" shortcut (`pandoc -t markdown file.docx`) needs `winget install --id JohnMacFarlane.Pandoc` (Windows) or `brew install pandoc` (macOS) first, or read with python-docx instead (`for p in doc.paragraphs: p.text`) — already installed and verified on Windows.
- **`docx` (npm) is NOT globally installed** here (checked with `npm ls -g` on Windows) — the "write a docx-js script" path needs `npm i -g docx` first. Until then, prefer **python-docx** — verified working here — for document creation.
- **Vietnamese text**: set the font on every run explicitly to `"Arial"`, `"Calibri"`, or `"Times New Roman"` — these ship with Windows and render Vietnamese diacritics correctly; on macOS these same names resolve via Office/LibreOffice's font substitution. Don't rely on the document's default theme font without checking it.

A `.docx` is a ZIP archive of XML files. Choose your approach by task:

| Task | Approach |
|---|---|
| **Create** a new document | Write a `docx` (npm) script — see gotchas below |
| **Edit** an existing document | `unzip` → edit `word/document.xml` → `zip` (docx-js cannot open existing files) |
| **Read** content | `pandoc -t markdown file.docx` |

> Script paths below are relative to this skill's directory.

## Creating with docx-js — gotchas

`docx` is preinstalled — do not run `npm install` first; write the script and `require('docx')` directly. Only if that require fails: `npm install docx`. The model knows the API; these are the footguns:

- **Page size defaults to A4.** For US Letter set `page: { size: { width: 12240, height: 15840 } }` (DXA; 1440 = 1″).
- **Landscape:** pass portrait dimensions and `orientation: PageOrientation.LANDSCAPE` — docx-js swaps width/height internally.
- **Tables need dual widths:** set `columnWidths` on the table AND `width` on every cell, both in `WidthType.DXA` (PERCENTAGE breaks in Google Docs). Column widths must sum to the table width.
- **Table shading:** use `ShadingType.CLEAR`, never `SOLID` (renders black).
- **Lists:** never insert `•` literally; use a `numbering` config with `LevelFormat.BULLET`.
- **`ImageRun` requires `type:`** (`"png"`, `"jpg"`, …).
- **`PageBreak` must be inside a `Paragraph`.**
- **Never use `\n`** — use separate `Paragraph` elements.
- **TOC:** headings must use built-in `HeadingLevel.*`; custom heading styles need `outlineLevel` set or they won't appear.
- **Don't use a table as a horizontal rule** — use a paragraph bottom border instead.
- **Dot-leader / right-aligned-on-same-line:** use `PositionalTab` (`alignment: PositionalTabAlignment.RIGHT`, `leader: PositionalTabLeader.DOT`) inside a `TextRun`, not literal `.` or space padding.

## Verify the output

After writing a `.docx`, render it and look at it:

```bash
python scripts/office/soffice.py --headless --convert-to pdf output.docx
pdftoppm -jpeg -r 100 output.pdf page
ls page-*.jpg   # then Read the images
```

`pdftoppm` zero-pads page numbers to the width of the page count (`page-01.jpg`…`page-12.jpg`).

## Editing existing documents

Legacy `.doc` files must be converted first: `python scripts/office/soffice.py --headless --convert-to docx file.doc`.

```bash
unzip -q doc.docx -d unpacked/
find unpacked -type l -delete   # strip symlink entries — docx from external parties is untrusted
python scripts/merge_runs.py unpacked/   # coalesce fragmented runs so text is findable
# edit unpacked/word/document.xml in place — do NOT reformat or pretty-print
(cd unpacked && rm -f ../out.docx && zip -Xr ../out.docx .)
python scripts/office/validate.py out.docx --original doc.docx   # XSD checks; --auto-repair fixes common issues
# redlining? add --author "<the name you redlined under>" to check every edit is tracked
```

Word splits text across many `<w:r>` runs (revision ids, spell-check markers), so a phrase you can see in the document often doesn't exist as a contiguous string in the XML. `merge_runs.py` merges adjacent identically-formatted runs in `word/document.xml` without changing content or rendering; it also accepts a `.docx` directly (`python scripts/merge_runs.py doc.docx -o merged.docx`).

**Tracked changes:** when redlining, validate with `--author "<the name you redlined under>"` (needs `--original`) — it reports any text you changed without a `<w:ins>`/`<w:del>` around it, which is easy to do by accident and invisible in the accepted view. Wrap runs in `<w:ins>`/`<w:del>` with `w:id`, `w:author`, `w:date` attributes. Inside `<w:del>`, the text element is `<w:delText>`, not `<w:t>`. A deleted paragraph mark (`<w:pPr><w:rPr><w:del w:id=".." w:author=".." w:date=".."/></w:rPr></w:pPr>`) means "merge this paragraph into the next" — so deleting a paragraph outright is that plus a `<w:del>` around every run. The `<w:del/>` must come before the rPr's other children; their order is schema-enforced.

To produce a clean copy with all tracked changes accepted: `python scripts/accept_changes.py in.docx out.docx`.

Accepting a deleted paragraph mark should join that paragraph to the one below it, so a paragraph whose runs are *all* deleted vanishes. Word does this; `accept_changes.py` and `pandoc --track-changes=accept` don't always. Both fail the same way — they strip the deleted text but leave the emptied paragraph behind, which reads as a stray empty bullet when it was auto-numbered:

- `pandoc --track-changes=accept` never joins the paragraphs.
- `accept_changes.py` (LibreOffice) joins them correctly, except when the deleted paragraph is followed by an empty spacer paragraph.

An empty bullet in either view is an artifact of that view, not a defect in the document. Check paragraph deletions in the XML.

## Comments

Comments require six cross-linked files. Use the helper — directory mode when you'll also be editing `document.xml` (saves an unzip/rezip cycle), `.docx`-direct mode otherwise:

```bash
# Against an already-unpacked directory (preferred when also placing markers)
python scripts/comment.py unpacked/ "Fees & expenses cap is too low"
python scripts/comment.py unpacked/ "Agreed" --parent 0

# Against a .docx directly
python scripts/comment.py contract.docx "This cap is too low" -o annotated.docx
```

The script writes `comments.xml`, `commentsExtended.xml`, `commentsIds.xml`, `commentsExtensible.xml`, the relationships, and the content-type overrides. Comment IDs are auto-assigned. It then prints the `<w:commentRangeStart>`/`<w:commentRangeEnd>`/`<w:commentReference>` snippet to add to `word/document.xml` so the comment anchors to specific text — until you place those markers, the comment exists but is not visible.

## Dependencies

`docx` (npm, preinstalled — install only if `require('docx')` fails) · `pandoc` · LibreOffice (`soffice`) · `pdftoppm` (Poppler)
