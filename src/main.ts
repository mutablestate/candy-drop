import "./assets/app.css";
import App from "./App.svelte";

(window as any).global = window;
if (global === undefined) {
  var global = window;
}

const app = new App({
  target: document.getElementById("app"),
});

export default app;
