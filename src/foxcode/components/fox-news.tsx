/**
 * Fox CLI: News/Notifications component — no-op stub.
 *
 * The cloud notifications feature (kilo-gateway) has been removed from Fox CLI.
 * This component renders nothing to preserve call sites that reference FoxNews.
 */

export function FoxNews() {
  // Fox CLI is local-only: no cloud notifications service.
  return null
}
