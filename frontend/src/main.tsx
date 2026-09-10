import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { PlayerProvider } from "./Player";
import { AuthProvider } from "./Auth";
import { LibraryProvider } from "./LibraryContext";
import { RoomsProvider } from "./RoomsContext";
import "./styles.css";
import "./library.css";
import "./uploads.css";
import "./rooms.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PlayerProvider>
          <LibraryProvider>
            <RoomsProvider>
              <App />
            </RoomsProvider>
          </LibraryProvider>
        </PlayerProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
