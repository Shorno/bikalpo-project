import assert from "node:assert/strict";
import test from "node:test";
import {
  getCurrentPositionWithFallback,
  getGeolocationErrorMessage,
} from "./browser-geolocation";

function geolocationError(code: number): GeolocationPositionError {
  return {
    code,
    message: "test geolocation error",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  };
}

function position(latitude = 23.8103, longitude = 90.4125) {
  return {
    coords: {
      accuracy: 20,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      latitude,
      longitude,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  } satisfies GeolocationPosition;
}

test("retries a timed-out high-accuracy request with normal accuracy", async () => {
  const options: PositionOptions[] = [];
  const expected = position();
  const geolocation = {
    getCurrentPosition(
      success: PositionCallback,
      error: PositionErrorCallback,
      nextOptions?: PositionOptions,
    ) {
      options.push(nextOptions ?? {});
      if (options.length === 1) {
        error(geolocationError(3));
        return;
      }
      success(expected);
    },
  };

  const result = await getCurrentPositionWithFallback(geolocation);

  assert.equal(result, expected);
  assert.deepEqual(options, [
    { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
    { enableHighAccuracy: false, maximumAge: 300_000, timeout: 20_000 },
  ]);
});

test("does not retry when location permission is denied", async () => {
  let attempts = 0;
  const denied = geolocationError(1);
  const geolocation = {
    getCurrentPosition(
      _success: PositionCallback,
      error: PositionErrorCallback,
    ) {
      attempts += 1;
      error(denied);
    },
  };

  await assert.rejects(
    getCurrentPositionWithFallback(geolocation),
    (error) => error === denied,
  );
  assert.equal(attempts, 1);
  assert.match(getGeolocationErrorMessage(denied), /blocked/i);
});

test("reports unavailable and timeout errors without blaming permission", () => {
  assert.match(getGeolocationErrorMessage(geolocationError(2)), /determine/i);
  assert.match(getGeolocationErrorMessage(geolocationError(3)), /too long/i);
  assert.doesNotMatch(
    getGeolocationErrorMessage(geolocationError(2)),
    /allow/i,
  );
  assert.doesNotMatch(
    getGeolocationErrorMessage(geolocationError(3)),
    /allow/i,
  );
});
