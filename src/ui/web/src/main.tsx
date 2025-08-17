import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./base.css";
import Startup from "./startup/Startup";

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <Startup onStart={() => console.log("Start pressed")} />
  </StrictMode>
);
