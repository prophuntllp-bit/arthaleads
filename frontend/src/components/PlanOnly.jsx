// PlanOnly.jsx — renders its children only when the org's plan includes the feature,
// otherwise the upgrade page. The server enforces the same rule; this keeps the
// customer from landing on a screen whose every request would be refused.
import UpgradeWall from "./UpgradeWall";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/plan";

export default function PlanOnly({ min, feature, description, children }) {
  const { org, user } = useAuth();
  if (user?.role === "super_admin" || canAccess(org, min)) return children;
  return <UpgradeWall org={org} feature={feature} description={description} needs={min} />;
}
