import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./global.css";
import Startup from "./startup/Startup";

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <Startup onStart={() => console.log("Start pressed")} />
  </StrictMode>
);
