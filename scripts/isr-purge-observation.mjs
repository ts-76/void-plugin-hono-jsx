// All variants share the deadline measured from the completed purge request.
// A later TTL refresh must not turn a missed purge into a passing observation.
export async function observePurge({ path, expected, completedAt, read, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), timeoutMs = 25000 }) {
  const deadline = completedAt + timeoutMs;
  const observation = { name: 'purge observation', path, expected, completedAt, outcome: 'fail' };
  try {
    while (now() < deadline) {
      const value = await read(path);
      observation.initialVersion ??= value.version;
      observation.initialCache ??= value.cache;
      observation.lastVersion = value.version;
      observation.lastCache = value.cache;
      if (value.version === expected && now() <= deadline) {
        observation.outcome = 'pass';
        return { value, observation };
      }
      const remaining = deadline - now();
      if (remaining > 0) await sleep(Math.min(1100, remaining));
    }
    throw new Error(`${path}: purge did not produce version ${expected} within ${timeoutMs}ms of purge completion`);
  } catch (error) {
    observation.error = error.message;
    throw Object.assign(error, { purgeObservation: observation });
  } finally {
    observation.elapsedMs = now() - completedAt;
  }
}
