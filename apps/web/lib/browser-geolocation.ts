type GeolocationProvider = Pick<Geolocation, "getCurrentPosition">;

const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

const HIGH_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 60_000,
  timeout: 10_000,
};

const FALLBACK_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 300_000,
  timeout: 20_000,
};

function requestCurrentPosition(
  geolocation: GeolocationProvider,
  options: PositionOptions,
) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function getErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "number"
  ) {
    return error.code;
  }

  return undefined;
}

export async function getCurrentPositionWithFallback(
  geolocation: GeolocationProvider,
) {
  try {
    return await requestCurrentPosition(geolocation, HIGH_ACCURACY_OPTIONS);
  } catch (error) {
    const code = getErrorCode(error);
    if (code !== POSITION_UNAVAILABLE && code !== TIMEOUT) {
      throw error;
    }
  }

  return requestCurrentPosition(geolocation, FALLBACK_OPTIONS);
}

export function getGeolocationErrorMessage(error: unknown) {
  switch (getErrorCode(error)) {
    case PERMISSION_DENIED:
      return "Location access is blocked for this site. Allow it in your browser settings or search for the business address.";
    case POSITION_UNAVAILABLE:
      return "Your device could not determine its current location. Check Windows Location Services or search for the business address.";
    case TIMEOUT:
      return "Finding your current location took too long. Try again or search for the business address.";
    default:
      return "We could not get your current location. Try again or search for the business address.";
  }
}
