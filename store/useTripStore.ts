import { create } from "zustand";

import type { Trip } from "../types/trip";

type TripState = {
  upcomingTrips: Trip[];
  setUpcomingTrips: (trips: Trip[]) => void;
};

export const useTripStore = create<TripState>((set) => ({
  upcomingTrips: [],
  setUpcomingTrips: (trips) => set({ upcomingTrips: trips }),
}));
