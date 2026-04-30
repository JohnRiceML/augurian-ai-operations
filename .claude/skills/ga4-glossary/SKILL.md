---
name: ga4-glossary
description: GA4 metric and dimension definitions, plus the quirks that bite analysts. Load when a subagent needs to interpret or compare GA4 numbers without confusing semantically-similar metrics.
---

# GA4 metric & dimension glossary

When in doubt, prefer this glossary over your training-data intuition. GA4 changed several semantics from UA, and an account lead will catch the mistakes.

## Metrics

| Metric | Definition | Use this when... | Don't confuse with... |
|---|---|---|---|
| `sessions` | Distinct user-engagement periods | Headline traffic comparisons | "visits" — sessions can be very short |
| `engagedSessions` | Sessions >10s OR >1 page OR conversion | Quality-of-traffic comparisons | `sessions` |
| `engagementRate` | engagedSessions / sessions | Modern bounce-rate inversion | `bounceRate` (just inverse, same data) |
| `bounceRate` | 1 − engagementRate | Clients used to UA's framing | `engagementRate` |
| `totalUsers` | Distinct users in period | Audience size | UA's "Users" — number is higher in GA4 |
| `newUsers` | First-ever visit landed in period | Acquisition reports | "first session" — uses property-lifetime history |
| `conversions` | Sum of conversion-flagged events | Conversion-volume comparisons | Purchases — depends on what's flagged |
| `totalRevenue` | Sum of `value` on revenue events | Revenue trend lines | Actual order revenue (5–15% gap typical) |
| `screenPageViews` | Pageviews + screen views | All-traffic page volume | UA's "pageviews" only |
| `screenPageViewsPerSession` | Per-session depth | Session-quality signals | — |
| `averageSessionDuration` | Avg seconds per session | Engagement depth | `engagementRate` |

## Dimensions

| Dimension | Definition | Use for |
|---|---|---|
| `sessionDefaultChannelGroup` | Channel of THIS session | Performance by channel |
| `firstUserDefaultChannelGroup` | Channel of user's FIRST session | Acquisition reports |
| `pagePath` | URL path, no query string | Most page analyses |
| `pageLocation` | Full URL with query string | UTM-tracking analyses |
| `landingPage` | First page of session | Funnel-entry analysis |
| `deviceCategory` | `desktop \| mobile \| tablet` | Device splits (note: smart TVs = mobile) |
| `country`, `region`, `city` | Geographic | Geographic — but watch for thresholding |

## Quirks that bite

1. **Sampling.** Reports >10M events in date range may be sampled. The Data API exposes a `samplingMetadata` field — check it. If sampling is happening, your numbers are estimates, not exact.

2. **Conversion config is property-specific.** "Conversions are down 40%" is often a config change, not a performance change. Cross-check with the GA4 admin UI before flagging.

3. **Time zone is the property's TZ.** Augurian's pullers compute "yesterday" in the property's TZ — see `pipelines/ga4_puller.py:yesterday_in_client_tz`.

4. **2-day settling.** Yesterday's numbers shift slightly when re-pulled tomorrow. Use 2-day-old data for "stable" comparisons.

5. **Threshold filtering.** GA4 hides rows with very small user counts for privacy. A row that looks like "0 users" may be "<10 users, hidden."

6. **`newUsers > totalUsers` is impossible.** If you see it, the property has a corrupted user-id config. Flag, don't report.

## Healthy-account ranges

If these break, the property is misconfigured — not Augurian's data:

- `engagementRate` ∈ [0.30, 0.85] for most retail/B2B sites.
- `averageSessionDuration` < 30s combined with `engagementRate` > 0.6 → engagement events firing automatically; data unreliable.
- `bounceRate` exactly 0 across all sources → all events are tagged "engaged"; misconfig.

## Cross-channel sanity check

When totaling across channels, GA4's "Direct" share should be **< 30%** for most healthy sites. >50% direct is usually a tracking gap (campaigns not tagged, server-side hits without source/medium).
