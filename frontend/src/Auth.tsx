import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { api, ApiError, json, message } from "./api";

type Account = { id: string; email: string; displayName: string };
type Auth = {
  user: Account | null;
  status: "loading" | "ready" | "error";
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<Auth | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider required");
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [status, setStatus] = useState<Auth["status"]>("loading");
  async function refresh() {
    setStatus("loading");
    try {
      setUser(await api<Account>("/api/auth/me"));
      setStatus("ready");
    } catch (error) {
      setUser(null);
      setStatus(
        error instanceof ApiError && error.status === 401 ? "ready" : "error",
      );
    }
  }
  useEffect(() => {
    let active = true;
    api<Account>("/api/auth/me")
      .then((value) => {
        if (active) {
          setUser(value);
          setStatus("ready");
        }
      })
      .catch((error) => {
        if (active)
          setStatus(
            error instanceof ApiError && error.status === 401
              ? "ready"
              : "error",
          );
      });
    const expire = () => {
      setUser(null);
      setStatus("ready");
    };
    window.addEventListener("unison-session-expired", expire);
    return () => {
      active = false;
      window.removeEventListener("unison-session-expired", expire);
    };
  }, []);
  async function signIn(email: string, password: string) {
    await api("/api/auth/login", {
      method: "POST",
      body: new URLSearchParams({ email, password }),
    });
    const account = await api<Account>("/api/auth/me");
    setUser(account);
    setStatus("ready");
  }
  async function signOut() {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
    setStatus("ready");
  }
  return (
    <AuthContext.Provider value={{ user, status, refresh, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AccountMenu() {
  const { user, status, refresh } = useAuth();
  return (
    <div className="account-menu">
      {status === "loading" ? (
        <span role="status">Checking your session…</span>
      ) : status === "error" ? (
        <button onClick={() => void refresh()}>Retry account connection</button>
      ) : (
        <Link to="/account">
          <UserRound size={17} />
          <span>
            {user ? user.displayName : "Sign in"}
            <small>{user ? "Your account" : "Make this space yours"}</small>
          </span>
        </Link>
      )}
    </div>
  );
}

export function AccountGate({ children }: { children: ReactNode }) {
  const { user, status, refresh } = useAuth();
  if (status === "loading")
    return (
      <div className="page-content" role="status">
        Checking your account…
      </div>
    );
  if (status === "error")
    return (
      <div className="page-content message-state">
        <h1>We couldn't check your session.</h1>
        <button className="secondary-button" onClick={() => void refresh()}>
          Try again
        </button>
      </div>
    );
  if (!user)
    return (
      <div className="page-content signed-out">
        <span className="section-kicker">YOUR UNISON ACCOUNT</span>
        <h1>More music. More connection.</h1>
        <p>
          Sign in to save favorites, create playlists, share music and join
          listening rooms.
        </p>
        <Link className="primary-button" to="/account">
          <LogIn size={17} />
          Sign in to continue
        </Link>
      </div>
    );
  return <div key={user.id}>{children}</div>;
}

export function AccountPage() {
  const { user, status, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    let created = false;
    try {
      if (register) {
        await api(
          "/api/auth/register",
          json("POST", { email, password, displayName }),
        );
        created = true;
      }
      await signIn(email, password);
      setPassword("");
      navigate(params.get("next") === "discover" ? "/" : "/library");
    } catch (failure) {
      if (created) {
        setRegister(false);
        setError(
          "Account created. Please sign in to continue. " + message(failure),
        );
      } else setError(message(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-content account-page">
      <p className="eyebrow">YOUR ACCOUNT</p>
      {user ? (
        <>
          <h1>Welcome, {user.displayName}.</h1>
          <div className="account-card">
            <UserRound size={32} />
            <h2>Your account</h2>
            <p>{user.email}</p>
            <p>Your favorites and playlists are private to this account.</p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button
              className="secondary-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await signOut();
                } catch (failure) {
                  setError(message(failure));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <LogOut size={16} />
              {busy ? "Signing out…" : "Sign out"}
            </button>
          </div>
          <Link className="text-link" to="/library">
            Go to your library →
          </Link>
        </>
      ) : (
        <>
          <h1>{register ? "Create an account" : "Welcome back."}</h1>
          <p className="page-description">
            Save the sounds you love. Make a collection that feels like you.
          </p>
          <form className="account-card form-stack" onSubmit={submit}>
            <div className="auth-tabs">
              <button
                type="button"
                aria-pressed={!register}
                onClick={() => {
                  setRegister(false);
                  setError("");
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                aria-pressed={register}
                onClick={() => {
                  setRegister(true);
                  setError("");
                }}
              >
                Create account
              </button>
            </div>
            {register && (
              <label>
                Display name
                <input
                  autoComplete="nickname"
                  value={displayName}
                  maxLength={60}
                  required
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>
            )}
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                maxLength={254}
                required
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                aria-describedby={register ? "password-hint" : undefined}
                minLength={register ? 10 : undefined}
                maxLength={64}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {register && (
                <small id="password-hint">
                  10–64 characters. Use a unique password.
                </small>
              )}
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="primary-button"
              disabled={busy || status === "loading"}
            >
              {busy
                ? "Please wait…"
                : register
                  ? "Create your account"
                  : "Sign in to Unison"}
            </button>
            {register && (
              <p className="form-note">
                Keep your password safe. Password recovery is not available.
              </p>
            )}
          </form>
        </>
      )}
    </div>
  );
}
