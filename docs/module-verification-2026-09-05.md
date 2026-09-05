# GRC module verification — 2026-09-05

Deployment tested: cbda3e3e51aab3f3c642ef423a8ede7bf04e715b, live Render service aether-ai.

## Authenticated browser checks

Signed in through secure browser authentication as the existing owner of Beta GRC. Fourteen module screens loaded: internal audit dashboard/universe/plans/observations/actions; enterprise risk dashboard/register/appetite/KRIs/taxonomy; compliance programs/evidence/policies/regulatory library. Existing operational registers were empty. The new-program dialog displayed all ten frameworks with the expected control counts. This verifies authenticated rendering and reference-data retrieval, not every record mutation or detail view.

## Database workflow checks

supabase/tests/module_workflows.sql passes against the live schema with synthetic tenant/user fixtures and authenticated-role/JWT claim simulation. All writes rolled back.

- Compliance: NCA program creation seeds 108 implementations; status/owner update changes implemented count and readiness.
- Enterprise risk: imports 49 taxonomy categories; creates a risk with generated code; assessment sets inherent score 20 and residual score 6 and creates attributed history; a KRI reading above its red threshold appears red in the summary view.
- Internal audit: universe entry generates a plan item; engagement imports a standard work program and summary count matches; high-rated observation and remediation action appear in engagement aggregates.

These checks invoke actual PostgreSQL functions and policies. They do not execute Next.js Server Actions or browser create/update/delete flows.

## AI execution check

The live risk-identification form returned five candidate risks, numeric scores and treatment suggestions for explicitly fictional context. No candidates were imported. Successful execution does not validate the substance of the output. One response invented a 70% supplier concentration figure absent from the input; assumption labeling and grounding remain a quality finding.

## Open verification

Not certified as fully working: populated detail views, browser write/read round trips, stage transitions, independent reviews, report issue/closure, evidence upload/download/linking, exports, every AI route, role matrix and cross-tenant browser tests remain outstanding. Previous security regression coverage remains applicable but is not full workflow certification. No application code or production records were changed by this verification pass.
