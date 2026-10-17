// crmShell.js - the signed-in CRM frame (sidebars, help bot, soft phone,
// onboarding, storage popup). App.jsx loads this lazily as one chunk, so the
// marketing site (www) never downloads it; only RequireAuth/RequireAdmin do.
export { default as Sidebar } from "./components/Sidebar";
export { default as AdminSidebar } from "./components/AdminSidebar";
export { default as ImpersonationBanner } from "./components/ImpersonationBanner";
export { default as HelpBot } from "./components/HelpBot";
export { default as OnboardingGate } from "./components/OnboardingGate";
export { default as SoftPhoneWidget } from "./components/SoftPhoneWidget";
export { default as StorageWarningPopup } from "./components/StorageWarningPopup";
export { SoftPhoneProvider } from "./context/SoftPhoneContext";
