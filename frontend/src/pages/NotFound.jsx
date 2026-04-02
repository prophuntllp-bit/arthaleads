import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="card max-w-lg p-10 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600">404</p>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-3 text-sm text-gray-500">
          The page you are looking for does not exist or you may not have access to it.
        </p>
        <Link to="/" className="btn-primary mt-6">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
