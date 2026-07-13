const DEFAULT_WRITE_QUOTA = 10_000;
const SCALE_SWITCH_RATIO = 0.2;
const WARNING_RATIO = 0.8;

function asFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeUserKey(value) {
  return String(value || "").trim().toLowerCase();
}

export function selectPresenceWriteScale(
  rows = [],
  quota = DEFAULT_WRITE_QUOTA,
) {
  const safeQuota = Math.max(1, asFiniteNumber(quota));
  const attentionValue = safeQuota * SCALE_SWITCH_RATIO;
  const peak = rows.reduce(
    (maximum, row) =>
      Math.max(
        maximum,
        asFiniteNumber(
          row?.count ??
            row?.writes ??
            (asFiniteNumber(row?.totalPresenceWrites) +
              asFiniteNumber(row?.counterFlushWrites)),
        ),
      ),
    0,
  );

  if (peak < attentionValue) {
    return {
      maxWrites: attentionValue,
      gridValues: [0, 0.25, 0.5, 0.75, 1].map(
        (ratio) => attentionValue * ratio,
      ),
      referenceLines: [
        {
          value: attentionValue,
          label: `20% · ${attentionValue / 1_000}k`,
          kind: "attention",
        },
      ],
    };
  }

  return {
    maxWrites: safeQuota,
    gridValues: [0, 0.25, 0.5, 0.75, 1].map(
      (ratio) => safeQuota * ratio,
    ),
    referenceLines: [
      {
        value: attentionValue,
        label: `20% · ${attentionValue / 1_000}k`,
        kind: "attention",
      },
      {
        value: safeQuota * WARNING_RATIO,
        label: `80% · ${(safeQuota * WARNING_RATIO) / 1_000}k`,
        kind: "warning",
      },
    ],
  };
}

export function buildLastSeenPresenceActivities(
  presenceDocs = [],
  cutoff = 0,
  now = Date.now(),
) {
  return presenceDocs
    .map((entry) => {
      const data = entry?.data || {};
      const lastSeenAt = asFiniteNumber(data.lastSeenAt || data.lastActive);
      const userKey = normalizeUserKey(data.userKey || data.email || entry?.id);
      if (
        !userKey ||
        !lastSeenAt ||
        lastSeenAt < cutoff ||
        lastSeenAt > now
      ) {
        return null;
      }
      return {
        userKey,
        displayName:
          String(data.displayName || data.name || userKey.split("@")[0]).trim(),
        role: String(data.role || "").trim(),
        lastSeenAt,
      };
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        left.lastSeenAt - right.lastSeenAt ||
        left.userKey.localeCompare(right.userKey),
    );
}

function addLaneEntry(lanes, source, kind) {
  const key = normalizeUserKey(source?.userKey || source?.email);
  if (!key) return;

  const lane = lanes.get(key) || {
    key,
    name: String(
      source?.displayName || source?.name || key.split("@")[0],
    ).trim(),
    role: String(source?.role || "").trim(),
    entries: [],
  };
  if (!lane.name && source?.displayName) lane.name = source.displayName;
  if (!lane.role && source?.role) lane.role = String(source.role).trim();
  lane.entries.push({ ...source, kind });
  lanes.set(key, lane);
}

export function buildPresenceTimelineLanes(
  sessions = [],
  estimates = [],
  lastSeenActivities = [],
) {
  const lanes = new Map();
  const usersWithPreciseActivity = new Set();

  sessions.forEach((session) => {
    const key = normalizeUserKey(session?.userKey || session?.email);
    if (key) usersWithPreciseActivity.add(key);
    addLaneEntry(lanes, session, "session");
  });

  estimates.forEach((estimate) => {
    const key = normalizeUserKey(estimate?.userKey || estimate?.email);
    if (key) usersWithPreciseActivity.add(key);
    addLaneEntry(lanes, estimate, "estimate");
  });

  lastSeenActivities.forEach((activity) => {
    const key = normalizeUserKey(activity?.userKey || activity?.email);
    if (!usersWithPreciseActivity.has(key)) {
      addLaneEntry(lanes, activity, "last-seen");
    }
  });

  return [...lanes.values()].sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.key.localeCompare(right.key),
  );
}
