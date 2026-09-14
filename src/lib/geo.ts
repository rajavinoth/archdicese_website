/** Great-circle distance in kilometres between two points. */
export const distanceKm = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number => {
  const EARTH_RADIUS_KM = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(to.latitude - from.latitude)
  const dLon = toRad(to.longitude - from.longitude)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLon / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

export const formatDistance = (km: number): string =>
  km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`

/** Chennai, used as the map's default centre before any filtering. */
export const CHENNAI_CENTRE = { latitude: 13.0604, longitude: 80.2496 }
