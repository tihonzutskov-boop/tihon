// The server counts a client's streak on the client's own calendar, so it has
// to be told which one that is. A cookie carries it on every request without
// touching each API call; it is not a secret, so it is readable by the page.
export const rememberTimeZone = (): void => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `gyde_tz=${encodeURIComponent(tz)}; path=/; max-age=31536000; SameSite=Lax${secure}`;
  } catch {
    // Without it the server counts days in UTC, which is only slightly off.
  }
};
