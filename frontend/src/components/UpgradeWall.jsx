// UpgradeWall.jsx — shown when a page/feature requires a higher plan
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { upgradeTarget, planLabel } from "../utils/plan";

export default function UpgradeWall({ org, feature, description }) {
  const current = planLabel(org?.plan);
  const next    = upgradeTarget(org?.plan);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#ff6b00]/10 flex items-center justify-center mb-6">
        <Lock className="w-7 h-7 text-[#ff6b00]" />
      </div>
      <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
        {feature} is a {next} feature
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-1">
        {description || `This feature is not available on your current ${current} plan.`}
      </p>
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">
        Upgrade to <strong className="text-[#ff6b00]">{next}</strong> to unlock it.
      </p>
      <div className="flex items-center gap-3">
        <Link to="/#pricing"
          className="px-6 py-2.5 rounded-xl bg-[#ff6b00] text-white font-semibold text-sm hover:bg-[#e05f00] transition-colors">
          View Plans
        </Link>
        <a href="mailto:contact@arthaleads.com"
          className="px-6 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-semibold text-sm hover:border-[#ff6b00] hover:text-[#ff6b00] transition-colors">
          Contact Us
        </a>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-600 mt-6">
        Currently on <span className="font-medium">{current}</span> plan
      </p>
    </div>
  );
}
