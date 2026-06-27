/**
 * @file src/services/locationService.ts
 * @description GPS coordinate formatting utilities for ResQ.
 *
 * Provides pure functions for converting raw GPS coordinate objects
 * into human-readable strings and Google Maps URLs.
 * These are dependency-free and fully unit-testable.
 */

import { GPSCoordinates } from '../types';

/**
 * Generates a Google Maps deep link for the given coordinates.
 *
 * If coordinates are unavailable (null), returns the base Google Maps URL
 * without a location query, which defaults to the user's current location.
 *
 * @param coords - GPS coordinate object from the Geolocation API
 * @returns Fully-formed Google Maps URL string
 *
 * @example
 * getGoogleMapsLink({ latitude: 12.9716, longitude: 80.2209, accuracy: 5, timestamp: Date.now() })
 * // → "https://www.google.com/maps?q=12.9716,80.2209"
 *
 * getGoogleMapsLink({ latitude: null, longitude: null, accuracy: null, timestamp: null })
 * // → "https://www.google.com/maps"
 */
export const getGoogleMapsLink = (coords: GPSCoordinates): string => {
  if (coords.latitude !== null && coords.longitude !== null) {
    return `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
  }
  return 'https://www.google.com/maps';
};

/**
 * Formats GPS coordinates into a human-readable cardinal direction string.
 *
 * Uses directional suffixes (N/S, E/W) and 4 decimal places (~11m precision).
 * Returns a 'Locating...' placeholder when coordinates are not yet available.
 *
 * @param coords - GPS coordinate object from the Geolocation API
 * @returns Formatted coordinate string or 'Locating...' if unavailable
 *
 * @example
 * formatCoordinates({ latitude: 12.9716, longitude: 80.2209, accuracy: 5, timestamp: 0 })
 * // → "12.9716° N, 80.2209° E"
 *
 * formatCoordinates({ latitude: -33.8688, longitude: 151.2093, accuracy: 10, timestamp: 0 })
 * // → "33.8688° S, 151.2093° E"
 */
export const formatCoordinates = (coords: GPSCoordinates): string => {
  if (coords.latitude !== null && coords.longitude !== null) {
    const latDir = coords.latitude >= 0 ? 'N' : 'S';
    const lngDir = coords.longitude >= 0 ? 'E' : 'W';
    return `${Math.abs(coords.latitude).toFixed(4)}° ${latDir}, ${Math.abs(coords.longitude).toFixed(4)}° ${lngDir}`;
  }
  return 'Locating...';
};

/**
 * Validates that a GPS coordinate object contains valid, non-null values.
 *
 * @param coords - GPS coordinate object to validate
 * @returns true if both latitude and longitude are present and within valid ranges
 */
export const hasValidCoordinates = (coords: GPSCoordinates): boolean => {
  return (
    coords.latitude !== null &&
    coords.longitude !== null &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
};
