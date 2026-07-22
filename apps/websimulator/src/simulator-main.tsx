import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import WebSimulatorApp from "./WebSimulatorApp.tsx";
import "./websimulator.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found.");
}

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <WebSimulatorApp />
  </StrictMode>
);
