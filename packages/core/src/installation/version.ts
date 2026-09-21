declare global {
  const FOX_VERSION: string
  const FOX_CHANNEL: string
  const FOX_BUILD_KIND: string
  const KILO_VERSION: string
  const KILO_CHANNEL: string
  const KILO_BUILD_KIND: string
}

export const InstallationVersion =
  typeof FOX_VERSION === "string" ? FOX_VERSION : typeof KILO_VERSION === "string" ? KILO_VERSION : "local"
export const InstallationChannel =
  typeof FOX_CHANNEL === "string" ? FOX_CHANNEL : typeof KILO_CHANNEL === "string" ? KILO_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
export const InstallationBuildKind: "source" | "release" =
  (typeof FOX_BUILD_KIND === "string" && FOX_BUILD_KIND === "release") ||
  (typeof KILO_BUILD_KIND === "string" && KILO_BUILD_KIND === "release")
    ? "release"
    : "source"