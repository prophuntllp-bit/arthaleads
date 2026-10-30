// The one page header (owner, 30 Oct 2026): the page's name, one short line on
// what it is for, and its main buttons on the right. Same look as Integrations
// and Leads. No small all-caps label above the title. Pages with a busier
// header use the same .page-header / .page-title / .page-subtitle classes.
import { ArrowLeft } from "lucide-react";

export default function PageHeader({ title, subtitle, actions, onBack, className = "" }) {
  return (
    <header className={`card page-header ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="Back" className="btn-ghost shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
