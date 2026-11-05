import React, { createContext, useContext, useState, useEffect } from 'react';
import { ViewerLocation, PermissionState } from '../types/index.ts';
import { CITY_PRESETS, CityPreset, calculateHaversineDistance } from '../lib/geo.ts';
import { Geolocation } from '@capacitor/geolocation';

interface LocationContextType {
  viewerLocation: ViewerLocation;
  currentCityPreset: CityPreset;
  isLoadingGps: boolean;
  gpsError: string | null;
  setCityPreset: (city: CityPreset) => void;
  requestLiveGps: () => Promise<void>;
  setPermissionState: (state: PermissionState) => void;
  getDistanceTo: (latitude: number, longitude: number) => number;
}

const DEFAULT_CITY = CITY_PRESETS[0]; // Kurnool

const DEFAULT_VIEWER_LOCATION: ViewerLocation = {
  coords: {
    latitude: DEFAULT_CITY.latitude,
    longitude: DEFAULT_CITY.longitude,
    accuracy: 15
  },
  cityName: DEFAULT_CITY.name,
  stateName: DEFAULT_CITY.state,
  country: DEFAULT_CITY.country,
  countryCode: DEFAULT_CITY.countryCode,
  isVerified: true, // Preset verified for testing
  verifiedTimestamp: Date.now(),
  permissionState: 'granted'
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentCityPreset, setCurrentCityPresetState] = useState<CityPreset>(DEFAULT_CITY);
  const [viewerLocation, setViewerLocation] = useState<ViewerLocation>(() => {
    try {
      const saved = localStorage.getItem('localnet_viewer_location');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return DEFAULT_VIEWER_LOCATION;
  });

  const [isLoadingGps, setIsLoadingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('localnet_viewer_location', JSON.stringify(viewerLocation));
    } catch (e) {
      // ignore
    }
  }, [viewerLocation]);

  const setCityPreset = (city: CityPreset) => {
    setCurrentCityPresetState(city);
    const updated: ViewerLocation = {
      coords: {
        latitude: city.latitude,
        longitude: city.longitude,
        accuracy: 25
      },
      cityName: city.name,
      stateName: city.state,
      country: city.country,
      countryCode: city.countryCode,
      isVerified: true,
      verifiedTimestamp: Date.now(),
      permissionState: 'granted'
    };
    setViewerLocation(updated);
    setGpsError(null);
  };

  const setPermissionState = (state: PermissionState) => {
    setViewerLocation(prev => ({
      ...prev,
      permissionState: state,
      isVerified: state === 'granted'
    }));
  };

  const requestLiveGps = async () => {
    setIsLoadingGps(true);
    setGpsError(null);

    const applyCoords = (latitude: number, longitude: number, accuracy: number) => {
      let nearestCity = CITY_PRESETS[0];
      let minDistance = Infinity;

      for (const city of CITY_PRESETS) {
        const dist = calculateHaversineDistance(latitude, longitude, city.latitude, city.longitude);
        if (dist < minDistance) {
          minDistance = dist;
          nearestCity = city;
        }
      }

      const resolvedCityName = minDistance < 50 ? nearestCity.name : `Near ${nearestCity.name} (${Math.round(minDistance)}km)`;

      const liveLocation: ViewerLocation = {
        coords: {
          latitude,
          longitude,
          accuracy: accuracy || 10
        },
        cityName: resolvedCityName,
        stateName: nearestCity.state,
        country: nearestCity.country,
        countryCode: nearestCity.countryCode,
        isVerified: true,
        verifiedTimestamp: Date.now(),
        permissionState: 'granted'
      };

      setViewerLocation(liveLocation);
      setIsLoadingGps(false);
    };

    try {
      // 1. Try Native Capacitor Hardware GPS first
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      applyCoords(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy || 10);
      return;
    } catch {
      // 2. Fallback to Browser Geolocation API
      if (!navigator.geolocation) {
        setGpsError('Geolocation is not supported by your browser.');
        setIsLoadingGps(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude, accuracy } = position.coords;
          applyCoords(latitude, longitude, accuracy);
        },
        error => {
          setIsLoadingGps(false);
          setGpsError(error.message || 'Unable to retrieve your location');
          setPermissionState('denied');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      );
    }
  };

  const getDistanceTo = (latitude: number, longitude: number): number => {
    return calculateHaversineDistance(
      viewerLocation.coords.latitude,
      viewerLocation.coords.longitude,
      latitude,
      longitude
    );
  };

  return (
    <LocationContext.Provider
      value={{
        viewerLocation,
        currentCityPreset,
        isLoadingGps,
        gpsError,
        setCityPreset,
        requestLiveGps,
        setPermissionState,
        getDistanceTo
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
