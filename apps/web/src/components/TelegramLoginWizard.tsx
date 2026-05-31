import { useState, type FormEvent } from "react";
import { ApiError } from "../lib/api";
import { useStartLogin, useVerifyLogin } from "../api/telegram";

type Step = "credentials" | "code";

// Multi-step Telegram login flow, driven entirely from the dashboard so a
// non-technical user never touches the CLI. Step 1 collects API id/hash + phone
// and triggers the login code; step 2 takes the code (and 2FA password when the
// account requires it) and completes the sign-in.
export function TelegramLoginWizard() {
  const [step, setStep] = useState<Step>("credentials");
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [phone, setPhone] = useState("");
  const [loginState, setLoginState] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);

  const start = useStartLogin();
  const verify = useVerifyLogin();

  const errorOf = (e: unknown) =>
    e instanceof ApiError ? e.message : e ? "Something went wrong" : null;

  const submitCredentials = (e: FormEvent) => {
    e.preventDefault();
    start.mutate(
      { apiId: Number(apiId), apiHash: apiHash.trim(), phone: phone.trim() },
      {
        onSuccess: (res) => {
          setLoginState(res.state);
          setStep("code");
        },
      },
    );
  };

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    verify.mutate(
      {
        state: loginState,
        code: code.trim(),
        password: needsPassword ? password : undefined,
      },
      {
        onSuccess: (res) => {
          if ("needsPassword" in res) {
            setNeedsPassword(true);
          }
          // On a completed login the parent's telegram-status query is
          // invalidated by the mutation, so this wizard unmounts on its own.
        },
      },
    );
  };

  if (step === "credentials") {
    return (
      <form className="tg-wizard" onSubmit={submitCredentials}>
        <p className="muted hint">
          Connect your Telegram account to start forwarding. Get your API id and hash from{" "}
          <a href="https://my.telegram.org" target="_blank" rel="noreferrer">
            my.telegram.org
          </a>{" "}
          → API development tools.
        </p>
        <label className="field">
          <span>API ID</span>
          <input
            value={apiId}
            onChange={(e) => setApiId(e.target.value)}
            inputMode="numeric"
            placeholder="1234567"
            autoFocus
          />
        </label>
        <label className="field">
          <span>API Hash</span>
          <input
            value={apiHash}
            onChange={(e) => setApiHash(e.target.value)}
            placeholder="0123456789abcdef0123456789abcdef"
          />
        </label>
        <label className="field">
          <span>Phone number</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+66812345678"
          />
        </label>

        {errorOf(start.error) && <div className="form-error">{errorOf(start.error)}</div>}

        <button
          className="btn btn-primary"
          type="submit"
          disabled={start.isPending || !apiId || !apiHash || !phone}
        >
          {start.isPending ? "Sending code…" : "Send login code"}
        </button>
      </form>
    );
  }

  return (
    <form className="tg-wizard" onSubmit={submitCode}>
      <p className="muted hint">
        Enter the login code Telegram just sent to <strong>{phone}</strong> (check the Telegram app).
      </p>
      <label className="field">
        <span>Login code</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          placeholder="12345"
          autoFocus
        />
      </label>

      {needsPassword && (
        <label className="field">
          <span>Two-factor password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your Telegram 2FA password"
            autoComplete="off"
          />
        </label>
      )}

      {errorOf(verify.error) && <div className="form-error">{errorOf(verify.error)}</div>}

      <div className="tg-wizard-actions">
        <button
          className="btn"
          type="button"
          onClick={() => {
            setStep("credentials");
            setCode("");
            setPassword("");
            setNeedsPassword(false);
          }}
          disabled={verify.isPending}
        >
          Back
        </button>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={verify.isPending || !code || (needsPassword && !password)}
        >
          {verify.isPending ? "Verifying…" : needsPassword ? "Submit password" : "Verify"}
        </button>
      </div>
    </form>
  );
}
