# Tooling reference — Google Cloud Run + Scheduler deployment

How the Augurian orchestrator and pullers actually get deployed. Practical brief, not a tutorial.

> Verify exact `gcloud` flags against current docs before running — Google's CLI surface has shifted before. The shape of the decisions below is stable.

## 1. Cloud Run Service vs Cloud Run Jobs

| Workload | Surface | Why |
|---|---|---|
| **Orchestrator** (listens to Slack, drives subagents) | Cloud Run **Service** | Long-lived. HTTP endpoint receives Slack events. Scales to zero when idle. |
| **Pullers** (GA4, GSC, Ads, Optmyzr — daily one-shots) | Cloud Run **Jobs** | No HTTP endpoint. Billed only for execution time. Cheaper than a service kept warm. |
| **Drive watcher** (polls every 5 min) | Cloud Run **Service** with `min-instances=1` | Long-lived poller; can't scale to zero or it stops watching. |

```bash
# Service (orchestrator)
gcloud run deploy augur-orchestrator --source .

# Job (puller)
gcloud run jobs deploy ga4-puller --image gcr.io/PROJECT/ga4-puller
```

## 2. Cloud Scheduler → Cloud Run Jobs

```bash
gcloud scheduler jobs create http ga4-puller-daily \
  --schedule="0 12 * * *" \
  --time-zone="America/Chicago" \
  --uri="https://REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/PROJECT/jobs/ga4-puller:run" \
  --http-method=POST \
  --oauth-service-account-email=scheduler-sa@PROJECT.iam.gserviceaccount.com \
  --location=us-central1
```

The Scheduler service account needs `roles/run.invoker` on the target Job. One scheduler entry per puller per client; cron strings live in this command, not in the Python.

## 3. Secret Manager — recommended pattern

**Workload Identity, not env vars in the deployment manifest.** The Cloud Run service runs as a service account; the service account has `roles/secretmanager.secretAccessor` on each secret it needs; the Python pulls secrets at startup.

```python
from google.cloud import secretmanager

def get_secret(secret_id: str) -> str:
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/PROJECT_ID/secrets/{secret_id}/versions/latest"
    return client.access_secret_version(request={"name": name}).payload.data.decode("UTF-8")

ANTHROPIC_API_KEY = get_secret("anthropic-api-key")
SLACK_BOT_TOKEN = get_secret("slack-bot-token")
```

`GOOGLE_APPLICATION_CREDENTIALS` is **automatic** when a service account is bound to a Cloud Run resource — don't try to mount a JSON key file. The Python Google libs pick up the bound identity.

```bash
gcloud secrets add-iam-policy-binding anthropic-api-key \
  --member="serviceAccount:orchestrator-sa@PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 4. Service account scoping — separate accounts per workload

Don't reuse one mega-account. Each Cloud Run resource gets its own SA with the minimum scopes it needs.

| Workload | Service account | Roles |
|---|---|---|
| Orchestrator | `orchestrator-sa` | `secretmanager.secretAccessor` (Anthropic key, Slack token) + Drive editor on `/Augurian Clients/` |
| GA4 puller | `ga4-puller-sa` | Drive editor on client folders + GA4 property Viewer (added in each client's GA4 admin) |
| GSC puller | `gsc-puller-sa` | Drive editor + GSC Restricted user per property |
| Ads puller | `ads-puller-sa` | Drive editor + Ads developer-token + OAuth refresh token in Secret Manager |
| Optmyzr puller | `optmyzr-puller-sa` | Drive editor + Optmyzr API key in Secret Manager |
| Scheduler trigger | `scheduler-sa` | `run.invoker` on each Job |

The blast radius of a leaked credential becomes one source, not all of them.

## 5. Failure alerting — pick one

**Option A (simplest, ships in 1 hour):** Each puller has a top-level `try/except` that posts to `#agent-activity` on exception, then re-raises. ~30 lines of Python, no Cloud infrastructure.

```python
try:
    main()
except Exception as exc:
    slack.chat_postMessage(
        channel="#agent-activity",
        text=f":rotating_light: {puller_name} failed for {client}\n```{traceback.format_exc()[:1500]}```"
    )
    raise
```

**Option B (production-grade, ships in 1 day):** Cloud Logging alert policy on `resource.type=cloud_run_job AND severity=ERROR`, fires to a Pub/Sub topic, Cloud Function consumes and posts to Slack. ~2-min alert latency. Survives a puller-itself bug that kills the in-puller alerter.

Start with A. Move to B in Phase 4 once two pullers are running.

## 6. Cold-start cost on the orchestrator

| Setting | Behavior | Idle cost | When to use |
|---|---|---|---|
| `min-instances=0` (default) | Cold start 5–15s on first request | $0 | Default. Fine for `@augur` Slack mentions — users tolerate 10s. |
| `min-instances=1` | Instant response | ~$0.88/month | Only if perceived latency becomes a complaint. |

The orchestrator is small enough that cold starts aren't a concern in Q2. Revisit if Phase 3 reveals a UX problem.

## 7. Realistic monthly cost (Q2 baseline)

| Component | Notes | Monthly |
|---|---|---|
| Orchestrator service | 20 interactions/day × 5s × 2 clients | ~$0.05 |
| Pullers (4 sources × 2 clients × 30 days) | ~2 min each, vCPU-priced | ~$8 |
| Drive watcher (continuous, 1 instance) | ~$5–10 depending on instance size | ~$8 |
| Cloud Scheduler | 8 jobs at $0.10 ea | ~$0.80 |
| Secret Manager | First 6 versions free | ~$0 |
| **Total GCP** | (excludes Anthropic API spend) | **~$17/mo** |

Anthropic API spend at Q2 scale (2 clients, ~30 monthly reports + ~60 daily anomaly checks + ~100 ad-hoc Slack queries): plan for **~$150–250/mo** with prompt caching working as designed.

**Total all-in for Q2:** ~$170–270/month. The playbook's $200 + $50 ballpark is realistic.

## 8. Implementation order (week 1–2)

1. Project + APIs enabled (Phase 0).
2. Service accounts + IAM bindings.
3. Secrets stored in Secret Manager.
4. Build GA4 puller container locally; push to Artifact Registry.
5. Deploy as a Cloud Run Job; trigger manually via `gcloud run jobs execute`.
6. Cloud Scheduler entry for the Job, daily 6 AM Central.
7. Slack-on-failure handler in the puller.
8. Watch logs for 5 days before declaring Phase 1 done.

Orchestrator service deploys in Phase 2; drive-watcher in Phase 3.
