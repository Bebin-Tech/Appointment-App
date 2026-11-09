import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return (
        <main className="public-page panel pad">
          <h1>Let’s get you back in flow.</h1>
          <p style={{ margin: "16px 0" }}>
            This page could not load. Try reloading it. Your saved demo data is
            kept in this browser.
          </p>
          <button className="btn primary" onClick={() => location.reload()}>
            Reload page
          </button>
          <details style={{ marginTop: 20 }}>
            <summary>Technical details</summary>
            <p>{String(this.state.error.message)}</p>
          </details>
        </main>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
