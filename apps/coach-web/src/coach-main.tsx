import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import CoachWebApp from "./CoachWebApp.tsx";
import "./coach-web.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found.");
}

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <CoachWebApp />
  </StrictMode>
);
