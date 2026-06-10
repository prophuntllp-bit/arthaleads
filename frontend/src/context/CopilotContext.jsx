import { createContext, useContext, useState } from "react";

const CopilotContext = createContext(null);

export function CopilotProvider({ children }) {
  const [focusedLead, setFocusedLead] = useState(null);
  return (
    <CopilotContext.Provider value={{ focusedLead, setFocusedLead }}>
      {children}
    </CopilotContext.Provider>
  );
}

export function useCopilot() {
  return useContext(CopilotContext);
}
