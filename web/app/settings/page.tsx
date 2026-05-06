"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStatus } from "@/lib/api";
import type { StatusResponse } from "@/lib/types";

const CLIENT_KEY = "augur.client";
const FOLDER_KEY = "augur.driveFolderId";
const AUTH_CMD = "python scripts/fireflies_walkthrough.py auth";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-augur-orange text-white text-[12px] font-semibold flex items-center justify-center">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium text-ink dark:text-ink-dark">{title}</div>
        <div className="mt-1 text-[13px] text-muted dark:text-muted-dark space-y-1">{children}</div>
      </div>
    </div>
  );
}

function Callout({
  tone,
  title,
  children,
}: {
  tone: "warn" | "info";
  title: string;
  children: React.ReactNode;
}) {
  const styles =
    tone === "warn"
      ? "border-amber-300 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-950/20"
      : "border-sky-300 bg-sky-50 dark:border-sky-700/50 dark:bg-sky-950/20";
  const titleColor =
    tone === "warn"
      ? "text-amber-900 dark:text-amber-200"
      : "text-sky-900 dark:text-sky-200";
  return (
    <div className={`rounded-md border px-3 py-2.5 ${styles}`}>
      <div className={`text-[13px] font-semibold ${titleColor}`}>{title}</div>
      <div className="mt-1 text-[13px] text-ink dark:text-ink-dark space-y-1">{children}</div>
    </div>
  );
}

function StatusRow({ label, state }: { label: string; state: string }) {
  const color =
    state === "connected"
      ? "text-emerald-600 dark:text-emerald-400"
      : state === "scope_missing"
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[14px] text-muted dark:text-muted-dark">{label}</span>
      <span className={`text-[14px] font-medium ${color}`}>
        {state.replace("_", " ")}
      </span>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-card border border-[color:var(--border)] bg-[color:var(--surface)] p-6 sm:p-7"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <h2 className="text-[17px] font-semibold tracking-tight text-ink dark:text-ink-dark">
        {title}
      </h2>
      {description && (
        <p className="mt-1 text-[13.5px] text-muted dark:text-muted-dark">
          {description}
        </p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [client, setClient] = useState("sandbox");
  const [folderId, setFolderId] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setStatus(await getStatus());
      } catch {
        /* leave null; UI shows "unknown" */
      }
    })();
    setClient(window.localStorage.getItem(CLIENT_KEY) || "sandbox");
    setFolderId(window.localStorage.getItem(FOLDER_KEY) || "");
  }, []);

  // Persist on change — there's no "save" button, but we render a
  // saved-indicator so the user gets feedback.
  useEffect(() => {
    window.localStorage.setItem(CLIENT_KEY, client);
  }, [client]);
  useEffect(() => {
    if (folderId) {
      window.localStorage.setItem(FOLDER_KEY, folderId);
    } else {
      window.localStorage.removeItem(FOLDER_KEY);
    }
  }, [folderId]);

  return (
    <div className="min-h-dvh w-full">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--bg)]/80 px-4 sm:px-6 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/"
            className="text-[14px] text-muted dark:text-muted-dark hover:text-ink dark:hover:text-ink-dark transition-colors"
          >
            ← Back to chat
          </Link>
          <span className="font-semibold tracking-tight">Settings</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8 space-y-5">
        <details
          open={
            !status ||
            status.drive !== "connected" ||
            status.ga4 !== "connected" ||
            status.gsc !== "connected" ||
            !status.anthropic_configured
          }
          className="group rounded-card border border-[color:var(--border)] bg-[color:var(--surface)] p-6 sm:p-7"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <summary className="flex cursor-pointer items-start justify-between list-none">
            <div>
              <h2 className="text-[17px] font-semibold tracking-tight text-ink dark:text-ink-dark">
                First-time setup
              </h2>
              <p className="mt-1 text-[13.5px] text-muted dark:text-muted-dark">
                Six steps in Google Cloud, then one CLI command. ~10 minutes the first time;
                everyone after you on your team does it once each.
              </p>
            </div>
            <span className="text-[12px] text-muted dark:text-muted-dark group-open:hidden">
              Show
            </span>
            <span className="text-[12px] text-muted dark:text-muted-dark hidden group-open:inline">
              Hide
            </span>
          </summary>

          <div className="mt-5 space-y-1">
            <Step n={1} title="Create a GCP project">
              <a
                href="https://console.cloud.google.com"
                target="_blank"
                rel="noreferrer"
                className="text-augur-orange hover:underline"
              >
                console.cloud.google.com
              </a>{" "}
              → top-left project dropdown → New Project. Name it{" "}
              <code className="font-mono">augurian-ai-ops</code>.
            </Step>

            <Step n={2} title="Enable three APIs">
              APIs &amp; Services → Library → enable each (search by name):
              <ul className="ml-1 mt-1 space-y-0.5">
                <li>• <code className="font-mono">Google Drive API</code></li>
                <li>
                  • <code className="font-mono">Google Analytics Data API</code>{" "}
                  <span className="text-muted dark:text-muted-dark">
                    — NOT &quot;Google Analytics API&quot; (deprecated)
                  </span>
                </li>
                <li>• <code className="font-mono">Google Search Console API</code></li>
              </ul>
            </Step>

            <Step n={3} title="Configure OAuth consent screen">
              APIs &amp; Services → OAuth consent screen.
              <ul className="ml-1 mt-1 space-y-0.5">
                <li>• User Type: <strong>Internal</strong> if available (Workspace orgs only — no token expiry).</li>
                <li>• Otherwise: <strong>External</strong>. App goes into Testing mode automatically — see step 4.</li>
              </ul>
            </Step>

            <Step n={4} title="If External + Testing — add yourself as a test user">
              <Callout tone="warn" title="The 403 access_denied trap">
                <p>
                  External + Testing only allows authorization for emails you explicitly add as
                  test users. <strong>Even the project owner needs to be on the list.</strong>{" "}
                  Without this, auth fails with{" "}
                  <code className="font-mono text-[12px]">Error 403: access_denied</code>.
                </p>
                <p className="mt-2">
                  <strong>How to add:</strong> Google Cloud → Google Auth Platform →{" "}
                  <strong>Audience</strong> → scroll to <strong>Test users</strong> → click{" "}
                  <strong>+ Add Users</strong> → enter the Google email you&apos;ll authorize
                  with → Save.
                </p>
                <p className="mt-2 text-[12px]">
                  Note: External + Testing tokens expire after 7 days. You&apos;ll re-run{" "}
                  <code className="font-mono">auth</code> weekly. Switch to Internal as soon as
                  the project lives in an Augurian Workspace org.
                </p>
              </Callout>
            </Step>

            <Step n={5} title="Create the OAuth client (Desktop)">
              APIs &amp; Services → Credentials → <strong>+ Create Credentials</strong> →{" "}
              <strong>OAuth client ID</strong>.
              <ul className="ml-1 mt-1 space-y-0.5">
                <li>
                  • Application type: <strong>Desktop app</strong>{" "}
                  <span className="text-muted dark:text-muted-dark">
                    (NOT Web — script uses <code className="font-mono">InstalledAppFlow</code>{" "}
                    on a random port)
                  </span>
                </li>
                <li>• Click Create → <strong>Download JSON</strong> on the dialog that pops.</li>
              </ul>
            </Step>

            <Step n={6} title="Save the JSON + run auth">
              <p>Move the downloaded file to:</p>
              <pre className="mt-1 overflow-x-auto rounded bg-[color:var(--bg)] p-2 font-mono text-[12px] border border-[color:var(--border)]">
                credentials/oauth_client.json
              </pre>
              <p className="mt-2">Then from the repo root:</p>
              <pre className="mt-1 overflow-x-auto rounded bg-[color:var(--bg)] p-2 font-mono text-[12px] border border-[color:var(--border)]">
                {AUTH_CMD}
              </pre>
              <p className="mt-2">
                Browser opens, you click through the consent, terminal prints success. Refresh
                this page — Drive / GA4 / GSC pills go green.
              </p>
            </Step>

            <div className="mt-4 pt-4 border-t border-[color:var(--border)] space-y-3">
              <Callout tone="info" title="Internal vs External + Testing — pick once">
                <p>
                  <strong>Internal (recommended):</strong> Anyone in your Augurian Workspace can
                  authorize. Tokens never expire. No test-users list.
                </p>
                <p className="mt-1">
                  <strong>External + Testing:</strong> Only listed test users (max 100) can
                  authorize. Tokens die after 7 days. You re-auth weekly.
                </p>
              </Callout>

              <Callout tone="warn" title="If you ever paste a client secret in chat / Slack / a doc">
                <p>
                  Rotate immediately. Cloud Console → Credentials → delete the OAuth client →
                  create a fresh one → re-download JSON → re-run <code className="font-mono">auth</code>.
                  The old token is now in someone&apos;s log; deleting the client revokes it.
                </p>
              </Callout>
            </div>
          </div>
        </details>

        <Card
          title="Drive connection"
          description="The Python OAuth flow grants Drive, GA4, and Search Console in a single consent. Re-run the CLI command to add scopes."
        >
          {status ? (
            <>
              <StatusRow label="Drive" state={status.drive} />
              <StatusRow label="GA4" state={status.ga4} />
              <StatusRow label="Search Console" state={status.gsc} />
              <StatusRow
                label="Anthropic key"
                state={status.anthropic_configured ? "connected" : "not_connected"}
              />
              <div className="mt-4 space-y-1 text-[12.5px] text-muted dark:text-muted-dark">
                {status.user_email && <div>Authenticated as: {status.user_email}</div>}
                <div>
                  Token file:{" "}
                  {status.token_path_exists ? "present" : "missing"} (credentials/drive_token.json)
                </div>
              </div>
            </>
          ) : (
            <div className="text-[13.5px] text-muted dark:text-muted-dark">
              Loading status…
            </div>
          )}
          {(!status ||
            status.drive !== "connected" ||
            status.ga4 !== "connected" ||
            status.gsc !== "connected") && (
            <div className="mt-5 rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] p-3">
              <p className="text-[13px] text-muted dark:text-muted-dark mb-2">
                Run this from the repo root:
              </p>
              <pre className="overflow-x-auto rounded bg-[color:var(--surface)] p-2 font-mono text-[12.5px] border border-[color:var(--border)]">
                {AUTH_CMD}
              </pre>
            </div>
          )}
        </Card>

        <Card
          title="Default client"
          description="Used as the {client} slug for every question. Saved to this browser only."
        >
          <input
            value={client}
            onChange={(e) => setClient(e.target.value)}
            spellCheck={false}
            className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-2 text-[14px] text-ink dark:text-ink-dark focus:border-augur-orange focus:outline-none"
          />
        </Card>

        <Card
          title="Drive folder ID"
          description="If left empty, search runs across the entire Drive. Setting this scopes search to one folder."
        >
          <input
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            spellCheck={false}
            placeholder="e.g. 1A2B3C…"
            className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-2 text-[14px] text-ink dark:text-ink-dark focus:border-augur-orange focus:outline-none"
          />
          <p className="mt-2 text-[12.5px] text-muted dark:text-muted-dark">
            Saved on change — no save button needed.
          </p>
        </Card>
      </main>
    </div>
  );
}
