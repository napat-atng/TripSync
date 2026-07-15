import { create } from "zustand";

import type { ItineraryEvent } from "../types/itinerary";

type ItineraryState = {
  events: ItineraryEvent[];
  isLoading: boolean;
  selectedDayNumber: number;
  setEvents: (events: ItineraryEvent[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setSelectedDayNumber: (day: number) => void;
  addEvent: (event: ItineraryEvent) => void;
  updateEvent: (eventId: string, data: Partial<ItineraryEvent>) => void;
  removeEvent: (eventId: string) => void;
};

export const useItineraryStore = create<ItineraryState>((set) => ({
  events: [],
  isLoading: false,
  selectedDayNumber: 1,
  setEvents: (events) => set({ events }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setSelectedDayNumber: (selectedDayNumber) => set({ selectedDayNumber }),
  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
  updateEvent: (eventId, data) =>
    set((state) => ({
      events: state.events.map((e) => (e.id === eventId ? { ...e, ...data } : e)),
    })),
  removeEvent: (eventId) =>
    set((state) => ({ events: state.events.filter((e) => e.id !== eventId) })),
}));
