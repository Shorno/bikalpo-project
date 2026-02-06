export function getPublicIdFromUrl(url: string): string | null {
  try {
    const regex = /\/v\d+\/(.+)\./;
    const match = url.match(regex);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
