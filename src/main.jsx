import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// ── v2 route: load V2Demo only when ?v=2 is in the URL ────────────────────────
// V1 (App) is the default — this is purely additive.
const V2Demo = lazy(() => import("./v2/V2Demo.jsx"));

const isV2 = new URLSearchParams(window.location.search).get("v") === "2";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isV2 ? (
      <Suspense fallback={<div style={{ color: "#fff", padding: 40 }}>Loading SignSpeak v2…</div>}>
        <V2Demo />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>
);