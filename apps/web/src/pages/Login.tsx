import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../lib/api";
import { useLogin, useMe } from "../api/auth";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();
  const navigate = useNavigate();
  const { data: me } = useMe();

  // Already authenticated → skip the form.
  useEffect(() => {
    if (me) navigate("/", { replace: true });
  }, [me, navigate]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(
      { username, password },
      { onSuccess: () => navigate("/", { replace: true }) },
    );
  };

  const errorMessage =
    login.error instanceof ApiError ? login.error.message : login.error ? "Login failed" : null;

  return (
    <div className="screen-center">
      <form className="card login-card" onSubmit={submit}>
        <h1 className="login-title">Forwarder</h1>
        <p className="muted login-sub">Sign in to manage your routes</p>

        <label className="field">
          <span>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        {errorMessage && <div className="form-error">{errorMessage}</div>}

        <button className="btn btn-primary" type="submit" disabled={login.isPending}>
          {login.isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
