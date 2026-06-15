import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./components/auth/AuthContext";
import { AuthGate } from "./components/auth/AuthGate";
import { installCredentialedBackendFetch } from "./lib/auth";
import { initFirebaseAnalytics, isFirebaseConfigured } from "./lib/firebase";

installCredentialedBackendFetch();

if (isFirebaseConfigured()) {
  void initFirebaseAnalytics();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <AuthGate>
        <App />
      </AuthGate>
    </AuthProvider>
  </StrictMode>
);
