import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./schemaTypes";

export default defineConfig({
  name: "default",
  title: "ArthaLeads Blog",
  projectId: "2racdioq",
  dataset: "production",
  plugins: [structureTool()],
  schema: { types: schemaTypes },
});
