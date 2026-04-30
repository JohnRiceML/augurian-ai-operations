# Augurian Pipelines: API Gotchas & Quirks

## GA4 (Google Analytics Data API)

**Library:** `google-analytics-data >= 0.18.0`

1. **Auth Quirk**
   - Service account (JSON key) only. No OAuth user flow. Store key securely; rotation = new app-scoped access.
   - Must grant service account email Editor access to GA4 property in Google Analytics UI.
   - Separate property ID from reporting identity (reporting identity is a UUID, not the property number).

2. **Quota/Scale Reality**
   - Default: 50K API queries/day, shared across entire workspace. At 10 clients × 3 reports/day = 30 calls. Safe.
   - Each dimension/metric combo = 1 API query (not row-based). Request audit scope upfront if scaling to 50+ clients.
   - Quota resets at midnight Pacific time; no per-minute rate limit, only daily.

3. **Data Lag**
   - Real-time reporting (minutes old) available but unreliable for historical data.
   - **Yesterday is safe** — query T-1 without worry. T-2 back is 99% complete.
   - Same-day reports lag 4–24 hours; never query today for prod pipelines.

4. **Pagination**
   - Client library handles it automatically via `RunReportRequest` (returns all rows in one response).
   - Row limit is 100K per request; if exceeding, split date range and stack results.
   - No cursor/offset pagination; GA4 is row-complete or error-out.

5. **The One Thing That Breaks (6+ months)**
   - **Dimension/metric deprecation.** Google periodically removes custom dimensions or low-traffic metrics. Static hardcoded metric lists break silently (return 0 rows). Validate metric existence in config, not code.
   - Token refresh is automatic (service account has no refresh token).

6. **Common Pitfall**
   - Confusing property ID (app-visible) with reporting identity (API UUID). Always fetch from API property listing first; hardcoding breaks on property clones.

---

## Google Search Console API

**Library:** `google-api-python-client >= 2.100.0` + `google-auth-httplib2`

1. **Auth Quirk**
   - Service account **cannot** query Search Console (GSC is user-centric, not property-centric).
   - Must use OAuth 2.0 (user flow) with stored refresh token. Store credentials securely in credential manager, not env var.
   - User must manually authorize the service account in GSC UI under "Verified Owners" or API auth will silently return empty data.

2. **Quota/Scale Reality**
   - 200 queries/day per user account. At 10 clients with 1 shared GSC account: **only ~20 queries/day budget** after overhead.
   - Per-second rate limit: 1 request/second (soft); batching requests = 429 backoff needed.
   - **Blocker at scale:** GSC doesn't support account-level API access. Each client needs separate GSC property; each property needs separate OAuth credential.

3. **Data Lag**
   - Data available 2–3 days behind real-time. Queries from today or yesterday return incomplete/partial data.
   - Query T-3 (3 days ago) for reliable reporting. T-2 shows ~90% complete data.

4. **Pagination**
   - Manual pagination required. API returns max 25K rows per request.
   - Use `start_row` parameter to iterate; track total row count and loop until `rowCount < 25000`.
   - No built-in continuation; you must implement the offset loop.

5. **The One Thing That Breaks (6+ months)**
   - **Refresh token expiration.** If token not used for 6 months, it expires silently. Rotation required.
   - OAuth consent screen scope changes by Google break existing apps; re-auth required.
   - Property URL structure changed (subdomains, http→https, trailing slash) = no data returned. Validate property URL matches GSC exactly.

6. **Common Pitfall**
   - Querying property root when data only exists in subdomains (or vice versa). GSC doesn't aggregate; query each separately.

---

## Google Ads API

**Library:** `google-ads >= 23.0.0`

1. **Auth Quirk**
   - **Developer token required** (account-level, not request-level). Apply to Google Ads account; 1-2 week approval per account.
   - OAuth 2.0 + refresh token (no service account). Developer token + user OAuth = required pair.
   - Manager account (MCC) tokens grant access to all linked sub-accounts; start there.
   - Tokens expire after 14 days of inactivity; refresh explicitly or requests fail silently.

2. **Quota/Scale Reality**
   - 60K queries/minute per developer token (shared across all your clients).
   - Query cost varies: simple searches = 1 unit, complex filters/joins = 10+ units. Check `estimated_total_num_operations` before scaling.
   - At 10 clients × 5 reports = 50 calls/day. Safe, unless reports are complex (nested conditions).
   - Plan 6–10 second latency per query in production (network + processing).

3. **Data Lag**
   - Campaign/ad performance data lags 3–4 hours from real-time.
   - Yesterday's data (T-1) is **99% complete** by noon Pacific.
   - Scheduled reports refresh daily at midnight UTC; pulling same-day data is unreliable.

4. **Pagination**
   - Client library handles pagination automatically. Set `page_size` (default 1000); library fetches all pages.
   - For 1M+ row exports, use `page_size=10000` and monitor memory (streaming recommended for 10M+ rows).
   - GAQL (Google Ads Query Language) supports `LIMIT/OFFSET` but pagination is automatic via client.

5. **The One Thing That Breaks (6+ months)**
   - **API version deprecation.** Google sunsetting API v13, v14 every ~6 months. Pin minor version (`google-ads==23.0.0`), test v24+ quarterly.
   - Campaign/audience IDs change after migration or merge; queries on hardcoded IDs fail.
   - MCC restructuring (sub-account linking) invalidates cached account hierarchies; re-fetch monthly.

6. **Common Pitfall**
   - Confusing manager account (MCC) token with customer token. MCC token grants access but doesn't enable direct reporting on MCC itself; you must query linked customer accounts.
   - Forgetting to renew refresh token; app fails at 14-day mark silently.

---

## Optmyzr API

**Library:** `requests` (no official SDK) + custom retry logic

1. **Auth Quirk**
   - API key in request header: `Authorization: Bearer <api_key>`.
   - API key tied to user account, not organization. Key rotation requires manual user action in Optmyzr UI.
   - No OAuth; pure API key auth. Treat keys like passwords; rotate every 90 days.

2. **Quota/Scale Reality**
   - Rate limit: **100 requests/minute** (undocumented; discovered via 429 responses).
   - No daily quota; just per-minute soft cap. Backoff required on 429.
   - Optmyzr doesn't scale well for 10+ clients (no batch/bulk exports). Each client = separate queries.
   - Expect timeouts on large account exports (>50K keywords); break into batches by date/campaign.

3. **Data Lag**
   - Data fresh within 1–2 hours of sync from Google Ads.
   - Queries for today are unreliable; start with T-1.
   - Manual syncs can be triggered but take 30 minutes; automated refresh is 6-hour cycle.

4. **Pagination**
   - **No pagination support.** API returns max 500 rows per endpoint. If dataset > 500, you get truncation (no offset/cursor).
   - Workaround: filter by date ranges, campaign IDs, or keywords to reduce result set below 500.
   - No official documentation on limits; test endpoints first.

5. **The One Thing That Breaks (6+ months)**
   - **Endpoint deprecation.** Optmyzr API is under-documented and not formally versioned. Endpoints change with product releases (no changelog).
   - Account structure sync failures (keyword deletions, campaign renames) not reflected in API; cache invalidation required.
   - Rate limit changes without notice (recently bumped 429s at scale); no SLA or status page.

6. **Common Pitfall**
   - Assuming pagination works like other APIs; script fails on large exports when hitting the 500-row cap.
   - API key permissions too broad (e.g., all accounts); rotation cascades to all clients. Use per-client API keys if possible.
   - No error details in 429 responses; retry blindly instead of implementing exponential backoff.

---

## Summary Table

| API | Library | Auth Type | Quota (10 clients) | Data Lag (safe) | Pagination | 6-mo Breakpoint |
|-----|---------|-----------|-------------------|-----------------|------------|-----------------|
| GA4 | `google-analytics-data` | Service account (JSON) | 50K queries/day | T-2+ | Auto | Metric deprecation |
| GSC | `google-api-python-client` | OAuth (refresh token) | 200 queries/day ⚠️ | T-3+ | Manual offset | Token expiry, URL changes |
| Ads | `google-ads` | OAuth + dev token | 60K ops/min (per token) | T-1+ | Auto | API version EOL, MCC restructure |
| Optmyzr | `requests` | API key (header) | 100 req/min | T-1+ | None (500 cap) | Endpoint deprecation, no changelog |

**Build Priority:** GA4 and Ads are production-ready at scale. GSC quota is a blocker (design for 1 GSC per 5–10 clients max). Optmyzr is best-effort only; plan fallback exports or manual pulls if API breaks mid-month.
