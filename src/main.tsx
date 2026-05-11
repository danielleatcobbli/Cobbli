import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initConsent } from "./lib/consent";

initConsent();

createRoot(document.getElementById("root")!).render(<App />);
