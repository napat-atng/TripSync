import { create } from "zustand";

import type { TripTask } from "../types/task";
import { toggleTaskCompletion } from "../lib/tasks";

type TaskState = {
  tasks: TripTask[];
  isLoading: boolean;
  setTasks: (tasks: TripTask[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  addTask: (task: TripTask) => void;
  removeTask: (taskId: string) => void;
  updateTaskLocal: (taskId: string, data: Partial<TripTask>) => void;
  /**
   * Flip a task's completion state immediately in the UI, then persist
   * to Supabase in the background. Rolls back to the previous state
   * (and rethrows) if the write fails, so the caller can surface an error.
   */
  toggleTaskOptimistic: (taskId: string, nextValue: boolean) => Promise<void>;
};

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  setTasks: (tasks) => set({ tasks }),
  setIsLoading: (isLoading) => set({ isLoading }),
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  removeTask: (taskId) => set((state) => ({ tasks: state.tasks.filter((t) => t.id !== taskId) })),
  updateTaskLocal: (taskId, data) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...data } : t)),
    })),
  toggleTaskOptimistic: async (taskId, nextValue) => {
    const previousTasks = get().tasks;

    // 1. Update the UI immediately, no waiting on the network.
    set({
      tasks: previousTasks.map((t) =>
        t.id === taskId
          ? { ...t, is_completed: nextValue, completed_at: nextValue ? new Date().toISOString() : null }
          : t,
      ),
    });

    // 2. Persist. On failure, roll back to the pre-toggle snapshot.
    try {
      await toggleTaskCompletion(taskId, nextValue);
    } catch (err) {
      set({ tasks: previousTasks });
      throw err;
    }
  },
}));

// ----------------------------------------------------------------
// Derived selector helper: progress = completed / total
// ----------------------------------------------------------------
export function selectTaskProgress(tasks: TripTask[]): { completed: number; total: number; pct: number } {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.is_completed).length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, pct };
}
