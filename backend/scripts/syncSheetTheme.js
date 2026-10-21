// Copies the Excel look (frontend/src/utils/sheetTheme.js) to the server as
// CommonJS: backend/utils/exports/sheetTheme.js, so a file made by the server
// (the phone's exports) looks exactly like one the web makes. Run after every
// change to the web file:  node scripts/syncSheetTheme.js
// tests/sheetTheme.sync.test.js fails while the two differ.
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "..", "frontend", "src", "utils", "sheetTheme.js");
const OUT = path.join(__dirname, "..", "utils", "exports", "sheetTheme.js");

function toCommonJs(src) {
  const names = [];
  const body = src
    .replace(/^export (const|function) (\w+)/gm, (_, kind, name) => { names.push(name); return `${kind} ${name}`; });
  if (/^\s*(export|import)\s/m.test(body)) throw new Error("sheetTheme.js gained an import/export this script does not handle");
  return `// GENERATED from frontend/src/utils/sheetTheme.js by backend/scripts/syncSheetTheme.js.\n// Do not edit here: change the web file and run the script.\n${body}\nmodule.exports = { ${names.join(", ")} };\n`;
}

if (require.main === module) {
  fs.writeFileSync(OUT, toCommonJs(fs.readFileSync(SRC, "utf8")));
  console.log(`wrote ${path.relative(process.cwd(), OUT)}`);
}
module.exports = { toCommonJs, SRC, OUT };
