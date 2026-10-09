import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  api: { projectId: "2racdioq", dataset: "production" },
  // Studio is hosted at https://arthaleads.sanity.studio
  studioHost: "arthaleads",
  deployment: { appId: "gaag9bhog2p01asevavkc8ec", autoUpdates: true },
});
