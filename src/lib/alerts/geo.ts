export type LatLng = { latitude: number; longitude: number };

const earthRadiusMiles = 3958.8;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

// Great-circle distance in miles.
export function haversineMiles(from: LatLng, to: LatLng) {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Floating-point slack so a subscriber exactly at their radius is included.
const boundaryToleranceMiles = 1e-6;

// Subscribers whose own radius reaches the market. The radius is inclusive.
export function matchSubscribers<Subscriber extends LatLng & { radius_miles: number }>(market: LatLng, subscribers: Subscriber[]) {
  return subscribers.filter((subscriber) => haversineMiles(market, subscriber) <= subscriber.radius_miles + boundaryToleranceMiles);
}
