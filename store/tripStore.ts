import { create } from "zustand";

import type { Trip } from "../types/trip";

type TripState = {
  trips: Trip[];
  currentTrip: Trip | null;
  isLoading: boolean;
  setTrips: (trips: Trip[]) => void;
  setCurrentTrip: (trip: Trip | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  removeTrip: (tripId: string) => void;
  updateTrip: (tripId: string, data: Partial<Trip>) => void;
};

export const useTripStore = create<TripState>((set) => ({
  trips: [],
  currentTrip: null,
  isLoading: false,
  setTrips: (trips) => set({ trips }),
  setCurrentTrip: (currentTrip) => set({ currentTrip }),
  setIsLoading: (isLoading) => set({ isLoading }),
  removeTrip: (tripId) => set((state) => ({ trips: state.trips.filter((t) => t.id !== tripId) })),
  updateTrip: (tripId, data) =>
    set((state) => ({
      trips: state.trips.map((t) => (t.id === tripId ? { ...t, ...data } : t)),
      currentTrip: state.currentTrip?.id === tripId ? { ...state.currentTrip, ...data } : state.currentTrip,
    })),
}));
