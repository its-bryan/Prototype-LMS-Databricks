import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router-dom";

const TOKEN_KEY = "leo_token";

function extractMessage(error) {
  if (isRouteErrorResponse(error)) {
    const payloadMessage = error?.data?.error?.message || error?.data?.detail;
    return payloadMessage || error.statusText || "Something went wrong while loading this page.";
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong while loading this page.";
}

function extractTraceId(error) {
  if (isRouteErrorResponse(error)) {
    return error?.data?.error?.traceId || error?.data?.traceId || null;
  }
  return error?.traceId || null;
}

export default function RouteErrorFallback() {
  const error = useRouteError();
  const navigate = useNavigate();
  const message = extractMessage(error);
  const traceId = extractTraceId(error);

  return (
    <div className="min-h-[50vh] bg-white p-8 flex flex-col items-center justify-center font-sans">
      <h1 className="text-2xl font-extrabold text-[var(--hertz-black)] mb-2">We hit an unexpected issue</h1>
      <p className="text-sm text-[var(--neutral-600)] text-center max-w-2xl">{message}</p>
      {traceId && (
        <p className="text-xs text-[var(--neutral-500)] mt-2">
          Reference ID: <span className="font-mono">{traceId}</span>
        </p>
      )}
      <div className="mt-5 flex gap-3">
        <button
          onClick={() => window.location.reload()}
          className="px-3 py-2 rounded-md bg-[var(--hertz-primary)] text-[var(--hertz-black)] font-semibold text-sm"
        >
          Retry
        </button>
        <button
          onClick={() => navigate("/", { replace: true })}
          className="px-3 py-2 rounded-md border border-[var(--neutral-300)] text-[var(--neutral-700)] font-medium text-sm"
        >
          Go Home
        </button>
        <button
          onClick={() => {
            try {
              sessionStorage.removeItem(TOKEN_KEY);
            } catch {
              // ignore
            }
            window.location.assign("/login");
          }}
          className="px-3 py-2 rounded-md border border-[var(--neutral-300)] text-[var(--neutral-700)] font-medium text-sm"
        >
          Re-login
        </button>
      </div>
    </div>
  );
}
