# pm-dashboard
DCDC PM dashboard for PMs status update

## UAT security handoff

The client authorization checks are defense-in-depth only. Before production release, verify and deploy Firestore Security Rules that enforce admin project creation/deletion, PM updates only for owned projects, and VIP read-only access. The complete production data schema and deployed rules are not present in this repository, so UAT approval must include a review against the actual Firebase project rather than relying on browser checks.
