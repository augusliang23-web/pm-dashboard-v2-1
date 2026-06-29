# Team 2 One-Time Excel Migration Runbook

Use this runbook only for the one-time Team 2 migration. The dashboard becomes the system of record after reconciliation; the workbook is not an ongoing synchronization source.

## Change record

Record these values before starting:

- UAT URL (must end in `/team-2/`):
- Expected dashboard version: `v2.0T-portfolio · base ddc0e5f`
- Dashboard version actually shown in the header:
- Date and time:
- Operator name and email:
- Reviewer name and email:
- Workbook filename:
- Workbook SHA-256:
- Worksheet name:
- Worksheet row count (excluding the header):
- First and last imported worksheet row:

Do not run the import from a production URL until UAT approval and Firestore Rules verification are documented.

## Before preview

1. Verify the header shows the approved UAT URL/version and the operator is signed in as Admin.
2. Verify deployed Firestore Security Rules—not only the browser controls—allow week writes only to authorized admins for this migration. Record the rules version or deployment identifier.
3. Export or back up the complete Firestore `weeks` collection. Record the export location, timestamp, project, and person who verified that it can be read.
4. Calculate and record the workbook SHA-256. Record the exact worksheet and source row range.
5. Keep the workbook unchanged after hashing. If it changes, stop and restart with a new hash and log entry.

## Preview and reconciliation

1. Select the intended target week in the dashboard, open **Import Excel**, and select the workbook.
2. Record the preview Ready, Skipped, and Failed counts and the target week.
3. Reconcile every source row to exactly one preview outcome. Confirm that Ready + Skipped + Failed equals the expected source-row count.
4. Stop if the preview contains any failed rows. Resolve every failed source row in a new, re-hashed workbook and repeat preview; never edit Firestore to make a preview pass.
5. Review the PMO Hours Completed warning. Leave its confirmation unchecked unless the operator and reviewer have verified that the workbook column means PMO actual hours. If checked, the dashboard will set PMO actual and calculate remaining as Estimated minus Actual, with a floor of zero.
6. Have the reviewer verify a sample of Project ID, Project Name, PM/Owner, project level, classification, product family, leads, volume, and resource estimates against the workbook.

## Confirmed import

1. Capture evidence of the final preview counts and target week.
2. Click **Confirm Import** and verify the confirmation repeats the exact Ready, Skipped, and Failed counts and target week.
3. Set the PMO semantics checkbox only when its meaning was verified and logged.
4. Check the separate authorization acknowledgement, then click **Import Confirmed Rows** once. Do not retry automatically after an error.
5. Wait for Firestore to resolve. A row is not successful until the dashboard reports completion.
6. Download the result CSV after the attempt, including failed attempts. Store it with the workbook hash, operator log, preview evidence, and Firestore backup reference.
7. Confirm result CSV columns are `rowNumber`, `projectId`, `status`, and `reason`, and reconcile its row count with the final preview.

## Post-import spot checks

1. In the target week, open at least one imported **System** project and one imported **Hardware Module** project.
2. Compare their Project IDs, names, PM/Owner, levels, classifications, product families, leads, volumes, and resource estimates to the hashed workbook.
3. Verify existing projects and unknown/custom fields were not overwritten.
4. Verify skipped live conflicts still contain their original data.
5. If PMO semantics was not confirmed, verify PMO actual/remaining is empty. If confirmed, verify actual/remaining against the source.
6. Verify each imported project has `importSource: "excel-one-time"` and ISO `importedAt`, `createdAt`, and `updatedAt` values.
7. Open **Overview** and verify the imported System and Hardware Module projects appear in the expected portfolio scopes and do not distort the displayed totals.
8. Record the spot-checked IDs, reviewer, result, and any discrepancy.

## Rollback

Rollback is an exception and requires the saved Firestore backup and result CSV.

1. Stop further dashboard edits and obtain change approval.
2. Use only IDs whose result CSV status is `success`.
3. In the exact target week’s `projects` array, remove only records whose Project ID is in that success list **and** whose `importSource` is exactly `excel-one-time`.
4. Never delete a same-named or same-coded record without both checks. Never replace the whole week document from an old workbook.
5. Perform the rollback with an approved atomic week-document update, preserving all other week fields and projects.
6. Reconcile the target week to the pre-import backup and record the rollback operator, reviewer, timestamp, IDs, and reason.

## Closeout

1. Archive the immutable workbook, SHA-256 record, worksheet/row/operator log, preview evidence, downloaded result CSV, spot-check evidence, backup reference, approval, and any rollback evidence together.
2. Mark the dashboard as the system of record. Archive the workbook as migration evidence, not as an active tracker.
3. Reconfirm the production Firestore Rules version enforces the approved Admin write boundary before production migration.
4. Record final Ready/Skipped/Failed totals, imported IDs, UAT approval, production approval, and closeout owner.
