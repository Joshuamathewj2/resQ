import { GPSCoordinates } from '../types';

export const getGoogleMapsLink = (coords: GPSCoordinates): string => {
  if (coords.latitude !== null && coords.longitude !== null) {
    return `https://www.google.com/maps?q=${coords.latitude},${coords.longitude}`;
  }
  return 'https://www.google.com/maps';
};

export const formatCoordinates = (coords: GPSCoordinates): string => {
  if (coords.latitude !== null && coords.longitude !== null) {
    const latDir = coords.latitude >= 0 ? 'N' : 'S';
    const lngDir = coords.longitude >= 0 ? 'E' : 'W';
    return `${Math.abs(coords.latitude).toFixed(4)}° ${latDir}, ${Math.abs(coords.longitude).toFixed(4)}° ${lngDir}`;
  }
  return 'Locating...';
};
