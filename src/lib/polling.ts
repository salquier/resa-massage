let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startPolling(fetchFn: () => void, intervalMs = 60_000): void {
  if (pollInterval !== null) {
    clearInterval(pollInterval);
  }
  fetchFn();
  pollInterval = setInterval(fetchFn, intervalMs);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) fetchFn();
  });
}

export function stopPolling(): void {
  if (pollInterval !== null) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
