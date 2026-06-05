import { create } from "zustand";

import type { Trip } from "../types/trip";

type TripState = {
  trips: Trip[];
  currentTrip: Trip | null;
  isLoading: boolean;
  setTrips: (trips: Trip[]) => void;
  setCurrentTrip: (trip: Trip | null) => void;
  setIsLoading: (isLoading: boolean) => void;
};

export const useTripStore = create<TripState>((set) => ({
  trips: [],
  currentTrip: null,
  isLoading: false,
  setTrips: (trips) => set({ trips }),
  setCurrentTrip: (currentTrip) => set({ currentTrip }),
  setIsLoading: (isLoading) => set({ isLoading }),
}));
