const esbuild = require("esbuild"); const path = require("path"); const here = __dirname;
esbuild.build({ entryPoints: [path.join(here, "entry.jsx")], bundle: true, outfile: path.join(here, "bundle.js"), format: "iife", platform: "browser", jsx: "automatic", loader: { ".js": "jsx" },
  nodePaths: [path.join(here, "../../node_modules")], define: { "process.env.NODE_ENV": '"development"', "import.meta.env": "{}" }, logLevel: "error",
  plugins: [{ name: "alias", setup(b) {
    b.onResolve({ filter: /services\/api$/ }, () => ({ path: path.join(here, "fakeStub.js") }));
    b.onResolve({ filter: /context\/SoftPhoneContext$/ }, () => ({ path: path.join(here, "../vistrow-outbound/fakeSoft.js") }));
  } }] }).then(() => console.log("bundled")).catch((e) => { console.error(e.message); process.exit(1); });
