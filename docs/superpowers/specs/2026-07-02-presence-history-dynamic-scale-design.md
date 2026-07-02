# Presence History Reliability and Dynamic Scale Design

## Scope

Improve the v2.0T Presence Usage view so known users who logged in can still
appear when exact session history is unavailable, and make low write volumes
readable without losing the 80% quota warning at higher usage.

## Root Cause

The current chart creates user lanes only from readable `presenceSessions`
documents and flushed 12-hour activity buckets. The deployed Firestore Rules do
not include `presenceSessions`, so the Admin query is denied. The existing
`presence.lastActive` value is cleared on logout and is not used to create chart
lanes. A user can therefore log in without appearing in the historical chart.

Gold activity blocks cover a complete 12-hour bucket because the original event
time and duration were not stored. They indicate one or more presence writes in
that bucket; they do not represent twelve hours online.

## Reliable Presence Sources

The chart combines three sources in descending order of precision:

1. **Recorded session** — exact or inferred start/end block from
   `presenceSessions`.
2. **Activity detected** — gold 12-hour bucket from presence usage counters;
   exact time and duration are unknown.
3. **Last seen** — a point marker from the persistent `presence.lastSeenAt`
   timestamp when neither of the first two sources represents that user at that
   time.

Every authenticated presence update writes both the transient `lastActive`
timestamp and persistent `lastSeenAt`. Logout clears only `lastActive`.

New session documents include `ownerUid`. This allows Rules to authorize session
ownership with Firebase Auth UID rather than relying on email case.

Historical data that lacks sessions, activity buckets, and `lastSeenAt` cannot
be reconstructed. Reliable fallback tracking begins after deployment.

## Firestore Rules

The repository will contain a complete `firestore.rules` file based on the
current production rules supplied by the user.

Rules add:

- Helper functions for signed-in and Admin checks.
- Authenticated users may create only sessions whose `ownerUid` matches their
  Auth UID and whose `userKey` matches their authenticated email.
- Authenticated users may update only their own session and only the mutable
  timing/state fields.
- Only Admin users may read `presenceSessions`.
- Only Admin users may read `presenceDailyRollups`.
- No client may write `presenceDailyRollups`; the Admin SDK bypasses client
  Rules.

`firebase.json` will reference the Rules file. Deployment is not performed from
this environment. The user must review and publish the complete file in Firebase
Console.

## Presence View

The existing Admin load already reads the `presence` collection. The renderer
will derive fallback last-seen records from those documents and pass them into
the shared Presence Usage chart.

Lane behavior:

- A user is listed when any selected-range session, activity estimate, or
  persistent last-seen timestamp exists.
- Last-seen markers have their own legend and tooltip.
- A last-seen marker does not imply a login duration.
- Recorded sessions and activity buckets retain their current semantics.

The explanatory copy and legend rename the gold state to
`Activity detected (time unknown)`.

## Dynamic Write Scale

The 12-hour free write quota remains 10,000.

- If every visible bucket is below 2,000 writes, the Y-axis maximum is 2,000.
  The grid uses 0, 500, 1,000, 1,500, and 2,000, and only the 20% line appears.
- If any visible bucket reaches 2,000 writes, the Y-axis maximum is 10,000.
  The full quota grid appears with both 20% and 80% lines.
- Values at or above the active scale maximum remain bounded within the chart.

The legend is rendered consistently with the active scale.

## Error Handling

- A denied session-history query does not hide write usage, activity estimates,
  or last-seen markers.
- Session creation/update failures remain non-blocking for dashboard access.
- The Admin view explicitly states when exact session history is unavailable.
- Missing or invalid timestamps are ignored without creating false lanes.

## Verification

Automated tests cover:

- Low-volume and high-volume scale selection.
- Correct 20% and 80% reference lines.
- Persistent `lastSeenAt` writes and logout preservation.
- Session `ownerUid`.
- Lane creation from sessions, activity estimates, and last-seen fallback.
- Last-seen de-duplication when a more precise source exists.
- Gold activity wording does not imply duration.
- Firestore Rules ownership, Admin-read, and rollup-write boundaries.

Browser verification covers:

- Low-volume bars are readable.
- The 80% line appears only after the 20% threshold is reached.
- Last-seen-only users appear with a point marker.
- Exact sessions and estimated activity remain visually distinct.
- No browser console errors.
