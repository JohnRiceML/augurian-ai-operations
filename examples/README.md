# Examples

Worked examples and fixtures. Used as regression cases for the orchestrator
and as reference for engineers building new subagents.

## Subdirectories (created as we accumulate examples)

- `monthly-reports/` — past drafted monthly reports (PII-stripped) plus the
   account lead's edited final. Lets us regression-test the monthly drafter.
- `gsc-anomalies/` — flagged anomaly summaries plus the human-marked
   real/noise/missed annotations. Used to tune detection thresholds.
- `fixtures/` — synthetic CSVs for unit tests. Never real client data.

## What goes here

- Outputs the team approved as "yes, this is what good looks like."
- Synthetic data for tests.

## What does NOT go here

- Real client data, even with PII stripped. The risk of accidental
   disclosure is too high. Use synthetic fixtures.
- Internal Augurian financial data.
- Anything that touches the redaction list.
