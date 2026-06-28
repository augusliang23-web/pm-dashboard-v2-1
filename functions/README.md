# Presence Session Aggregation

The v2.0T client writes login sessions to `presenceSessions`. The scheduled
`aggregatePresenceSessions` function converts closed or timed-out sessions into
daily per-user documents in `presenceDailyRollups`.

## Deploy

1. Install the Firebase CLI and authenticate to the Firebase project.
2. From the repository root, run:

   ```powershell
   firebase use project-manager-dashboar-a067f
   firebase deploy --only functions:aggregatePresenceSessions
   ```

3. In Google Cloud Firestore, create a TTL policy for collection group
   `presenceSessions` using the timestamp field `expiresAt`.

   ```powershell
   gcloud firestore fields ttls update expiresAt `
     --collection-group=presenceSessions `
     --project=project-manager-dashboar-a067f `
     --enable-ttl
   ```

Session detail is retained for 90 days. Daily rollups do not contain an
`expiresAt` field and are therefore retained.

## Required access

Authenticated users need permission to create and update their own
`presenceSessions` document. Admin users need read access to session history.
Only the Admin SDK used by this function should write `presenceDailyRollups`.
