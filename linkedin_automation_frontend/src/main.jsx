import React from "react";
import { createRoot } from "react-dom/client";
import { BriefcaseBusiness, CheckCircle2, Clock3, Mail, Play, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050";

const initialForm = {
  linkedinEmail: "",
  linkedinPassword: "",
  verifiedEmail: "",
  jobRole: "Java Developer",
  experience: "3-5 Years",
  location: "Remote",
  last24Hours: true,
  remoteJobs: true,
  contractRoles: false,
  immediateHiring: false,
  maxPostsPerQuery: 5
};

function App() {
  const [page, setPage] = React.useState("dashboard");
  const [form, setForm] = React.useState(initialForm);
  const [status, setStatus] = React.useState("idle");
  const [health, setHealth] = React.useState(null);
  const [summary, setSummary] = React.useState(null);
  const [backendStatus, setBackendStatus] = React.useState(null);
  const [verificationCode, setVerificationCode] = React.useState("");
  const [emailVerified, setEmailVerified] = React.useState(() => {
    const saved = localStorage.getItem("emailVerified");
    return saved ? JSON.parse(saved) : false;
  });
  const [logs, setLogs] = React.useState(["Dashboard ready. Verify your email before automation."]);
  const lastStatusRef = React.useRef("");

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const addLog = (message) => {
    setLogs((current) => [`${new Date().toLocaleTimeString()}  ${message}`, ...current].slice(0, 14));
  };

  const checkHealth = async () => {
    try {
      const response = await fetch(`${API_URL}/api/health`);
      const data = await response.json();
      setHealth(data);
      addLog(`Backend online. Gemini ${data.aiEnabled ? "enabled" : "disabled"}, Resend ${data.emailConfigured ? "configured" : "not configured"}.`);
    } catch (error) {
      setHealth(null);
      addLog(`Backend check failed: ${error.message}`);
    }
  };

  React.useEffect(() => {
    checkHealth();
  }, []);

  const pollStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/api/status`);
      const data = await response.json();
      setBackendStatus(data);

      if (data.message && data.message !== lastStatusRef.current) {
        lastStatusRef.current = data.message;
        addLog(data.message);
      }

      return data;
    } catch (error) {
      addLog(`Status check failed: ${error.message}`);
      return null;
    }
  };

  const sendVerificationCode = async () => {
    addLog("Sending verification code.");

    try {
      const response = await fetch(`${API_URL}/api/email/send-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.verifiedEmail })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not send code.");
      }

      addLog(data.message);
    } catch (error) {
      addLog(`Verification failed: ${error.message}`);
    }
  };

  const verifyEmailCode = async () => {
    addLog("Checking verification code.");

    try {
      const response = await fetch(`${API_URL}/api/email/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.verifiedEmail, code: verificationCode })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Code is incorrect.");
      }

      setEmailVerified(true);
      localStorage.setItem("emailVerified", JSON.stringify(true));
      addLog(data.message);
    } catch (error) {
      setEmailVerified(false);
      localStorage.setItem("emailVerified", JSON.stringify(false));
      addLog(`Verification failed: ${error.message}`);
    }
  };

  const clearVerification = () => {
    setEmailVerified(false);
    localStorage.setItem("emailVerified", JSON.stringify(false));
    setVerificationCode("");
    addLog("Email verification cleared. Please verify again.");
  };

  const startAutomation = async (event) => {
    event.preventDefault();
    setStatus("running");
    setSummary(null);
    lastStatusRef.current = "";
    addLog("Sending automation request.");

    const statusTimer = window.setInterval(pollStatus, 2500);

    try {
      const response = await fetch(`${API_URL}/api/jobs/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...form,
          linkedinPassword: btoa(form.linkedinPassword)
        })
      });

      const data = await response.json();
      setSummary(data);
      setStatus(data.success ? "complete" : "error");
      setPage("results");
      addLog(data.success ? "Automation completed." : `Automation stopped: ${data.error || data.message}`);
    } catch (error) {
      setStatus("error");
      addLog(`Request failed: ${error.message}`);
    } finally {
      window.clearInterval(statusTimer);
      pollStatus();
    }
  };

  const metrics = [
    { label: "Searches", value: summary?.totalSearchQueries ?? 0, icon: BriefcaseBusiness },
    { label: "Posts", value: summary?.totalPostsFound ?? 0, icon: Clock3 },
    { label: "Emails", value: summary?.totalEmailsSent ?? 0, icon: Mail },
    { label: "Duplicates", value: summary?.totalSkippedDuplicates ?? 0, icon: CheckCircle2 }
  ];

  return (
    <main className="app">
      <aside className="sidebar">
        <div>
          <div className="brand">
            <div className="brand-mark">LA</div>
            <div>
              <h1>LinkedIn Automation</h1>
              <p>AI job outreach console</p>
            </div>
          </div>
          <nav className="nav">
            <button className={page === "dashboard" ? "active" : ""} onClick={() => setPage("dashboard")} type="button">Dashboard</button>
            <button className={page === "results" ? "active" : ""} onClick={() => setPage("results")} type="button">Results</button>
            <button className={page === "settings" ? "active" : ""} onClick={() => setPage("settings")} type="button">Settings</button>
          </nav>
        </div>
        <div className="system-card">
          <SystemRow icon={Sparkles} label="Gemini" value={health?.aiEnabled ? "On" : "Off"} />
          <SystemRow icon={Mail} label="Resend" value={health?.emailConfigured ? "Ready" : "Setup"} />
          <SystemRow icon={ShieldCheck} label="Verified" value={emailVerified ? "Yes" : "No"} />
        </div>
      </aside>

      <section className="workspace">
        {page === "dashboard" && (
          <DashboardPage
            form={form}
            updateForm={updateForm}
            startAutomation={startAutomation}
            status={status}
            health={health}
            emailVerified={emailVerified}
            backendStatus={backendStatus}
            metrics={metrics}
            checkHealth={checkHealth}
          />
        )}

        {page === "results" && (
          <ResultsPage summary={summary} logs={logs} />
        )}

        {page === "settings" && (
          <SettingsPage
            form={form}
            updateForm={updateForm}
            health={health}
            emailVerified={emailVerified}
            verificationCode={verificationCode}
            setVerificationCode={setVerificationCode}
            sendVerificationCode={sendVerificationCode}
            verifyEmailCode={verifyEmailCode}
            checkHealth={checkHealth}
            clearVerification={clearVerification}
          />
        )}
      </section>
    </main>
  );
}

function DashboardPage({ form, updateForm, startAutomation, status, health, emailVerified, backendStatus, metrics, checkHealth }) {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h2>Run LinkedIn post search, AI email drafting, and automated recruiter outreach.</h2>
        </div>
        <button className="icon-button" type="button" onClick={checkHealth} aria-label="Refresh backend status" title="Refresh backend status">
          <RefreshCw size={18} />
        </button>
      </header>

      <section className="metrics">
        <div className="metric status-metric">
          <RefreshCw size={19} className={backendStatus?.running ? "spin" : ""} />
          <span>Current step</span>
          <strong>{backendStatus?.step || "idle"}</strong>
          <small>{backendStatus?.message || "Ready"}</small>
        </div>
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div className="metric" key={metric.label}>
              <Icon size={19} />
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          );
        })}
      </section>

      <form className="panel grid" onSubmit={startAutomation}>
        <div className="form-section">
          <h3>LinkedIn Login</h3>
          <label>
            Email
            <input value={form.linkedinEmail} onChange={(event) => updateForm("linkedinEmail", event.target.value)} type="email" required placeholder="linkedin@example.com" />
          </label>
          <label>
            Password
            <input value={form.linkedinPassword} onChange={(event) => updateForm("linkedinPassword", event.target.value)} type="password" required placeholder="LinkedIn password" />
          </label>
        </div>

        <div className="form-section">
          <h3>Target Role</h3>
          <label>
            Job role
            <input value={form.jobRole} onChange={(event) => updateForm("jobRole", event.target.value)} placeholder="Java Developer" />
          </label>
          <label>
            Experience
            <select value={form.experience} onChange={(event) => updateForm("experience", event.target.value)}>
              <option>Fresher</option>
              <option>1-2 Years</option>
              <option>3-5 Years</option>
              <option>5+ Years</option>
            </select>
          </label>
          <label>
            Location
            <input value={form.location} onChange={(event) => updateForm("location", event.target.value)} placeholder="Remote" />
          </label>
        </div>

        <div className="form-section">
          <h3>Search Filters</h3>
          <label>
            Posts per search
            <input min="1" max="20" value={form.maxPostsPerQuery} onChange={(event) => updateForm("maxPostsPerQuery", Number(event.target.value))} type="number" />
          </label>
          <div className="toggles">
            <Switch label="Last 24 hours" checked={form.last24Hours} onChange={(value) => updateForm("last24Hours", value)} />
            <Switch label="Remote or hybrid only" checked={form.remoteJobs} onChange={(value) => updateForm("remoteJobs", value)} />
            <Switch label="Search C2C hiring" checked={form.contractRoles} onChange={(value) => updateForm("contractRoles", value)} />
            <Switch label="Search immediate hiring" checked={form.immediateHiring} onChange={(value) => updateForm("immediateHiring", value)} />
          </div>
        </div>

        <div className="action-row">
          <button className="primary-button" disabled={status === "running" || !health?.emailConfigured || !emailVerified} type="submit">
            {status === "running" ? <RefreshCw className="spin" size={18} /> : <Play size={18} />}
            {status === "running" ? "Running automation" : "Start automation"}
          </button>
          <p>{!health?.emailConfigured ? "Resend is not configured." : !emailVerified ? "Verify your email in Settings first." : "Browser opens LinkedIn on this machine."}</p>
        </div>
      </form>
    </>
  );
}

function ResultsPage({ summary, logs }) {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Results</p>
          <h2>Review searches, emails, skipped duplicates, and run logs.</h2>
        </div>
      </header>

      <section className="split">
        <div className="panel">
          <h3>Latest Results</h3>
          <div className="results-list tall">
            {(summary?.results || []).map((result, index) => (
              <article className="result-item" key={`${result.recruiterEmail || result.error}-${index}`}>
                <div>
                  <strong>{result.recruiterName || result.category || "Result"}</strong>
                  <span>{result.recruiterEmail || result.error || result.query}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <em>{result.status}</em>
                  {result.emailBody && result.recruiterEmail && (
                    <a
                      href={`mailto:${result.recruiterEmail}?subject=Application for ${encodeURIComponent(result.category)} Opportunity&body=${encodeURIComponent(result.emailBody)}`}
                      className="secondary-button"
                      style={{ padding: "4px 8px", fontSize: "12px", marginLeft: "auto" }}
                      title="Send email manually using your default email client"
                    >
                      Send Email Manually
                    </a>
                  )}
                </div>
              </article>
            ))}
            {!summary?.results?.length && <p className="empty">Results will appear after a run.</p>}
          </div>
        </div>

        <div className="panel">
          <h3>Run Log</h3>
          <div className="log-list tall">
            {logs.map((log) => <p key={log}>{log}</p>)}
          </div>
        </div>
      </section>
    </>
  );
}

function SettingsPage({ form, updateForm, health, emailVerified, verificationCode, setVerificationCode, sendVerificationCode, verifyEmailCode, checkHealth, clearVerification }) {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Verify your email and confirm AI usage.</h2>
        </div>
        <button className="icon-button" type="button" onClick={checkHealth} aria-label="Refresh settings" title="Refresh settings">
          <RefreshCw size={18} />
        </button>
      </header>

      <section className="split">
        <div className="panel form-section">
          <h3>Email Verification</h3>
          <div className="button-row">
            <span className={health?.emailConfigured ? "status-good" : "status-warn"}>{health?.emailConfigured ? "Resend ready" : "Resend not configured"}</span>
          </div>
          <label>
            Email to verify
            <input value={form.verifiedEmail} onChange={(event) => updateForm("verifiedEmail", event.target.value)} type="email" placeholder="your@email.com" />
          </label>
          <div className="button-row">
            <button className="secondary-button" type="button" disabled={!health?.emailConfigured} onClick={sendVerificationCode}>Send code</button>
          </div>
          <label>
            Verification code
            <input value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} inputMode="numeric" placeholder="6 digit code" />
          </label>
          <div className="button-row">
            <button className="primary-button" type="button" onClick={verifyEmailCode}>Verify email</button>
            {emailVerified && (
              <button className="secondary-button" type="button" onClick={clearVerification}>Clear Verification</button>
            )}
            <span className={emailVerified ? "status-good" : "status-warn"}>{emailVerified ? "Verified" : "Not verified"}</span>
          </div>
        </div>

        <div className="panel">
          <h3>Where Gemini AI Is Used</h3>
          <div className="info-list">
            <p><strong>Search planning:</strong> Gemini builds LinkedIn search queries from role, location, experience, C2C, and immediate hiring filters.</p>
            <p><strong>Email drafting:</strong> Gemini writes a concise recruiter email using the post text and selected role details.</p>
            <p><strong>Fallback:</strong> If Gemini is missing or fails, the app uses simple built-in query and email templates.</p>
          </div>
        </div>
      </section>
    </>
  );
}

function SystemRow({ icon: Icon, label, value }) {
  return (
    <div className="system-row">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Switch({ label, checked, onChange }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span />
      {label}
    </label>
  );
}

createRoot(document.getElementById("root")).render(<App />);
