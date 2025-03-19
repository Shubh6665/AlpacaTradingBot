import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Add global styles for dark theme
document.documentElement.classList.add('dark');
document.body.style.backgroundColor = '#121722';
document.body.style.color = '#B7BDC6';
document.body.style.fontFamily = "'Inter', sans-serif";

createRoot(document.getElementById("root")!).render(<App />);
