function normalizedEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function isAuthInitializationCurrent(
  currentGeneration,
  expectedGeneration,
  currentUser,
  expectedUid,
  expectedEmail,
) {
  return currentGeneration === expectedGeneration
    && String(currentUser?.uid ?? '') === String(expectedUid ?? '')
    && normalizedEmail(currentUser?.email) === normalizedEmail(expectedEmail);
}
