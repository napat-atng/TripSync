import { create } from "zustand";

import type { TripComment } from "../types/comment";

type CommentState = {
  comments: TripComment[];
  isLoading: boolean;
  setComments: (comments: TripComment[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  appendComment: (comment: TripComment) => void;
  removeComment: (commentId: string) => void;
};

export const useCommentStore = create<CommentState>((set) => ({
  comments: [],
  isLoading: false,
  setComments: (comments) => set({ comments }),
  setIsLoading: (isLoading) => set({ isLoading }),
  appendComment: (comment) =>
    set((state) =>
      // Guard against double-appending the same message (optimistic add + realtime echo)
      state.comments.some((c) => c.id === comment.id)
        ? state
        : { comments: [...state.comments, comment] },
    ),
  removeComment: (commentId) =>
    set((state) => ({ comments: state.comments.filter((c) => c.id !== commentId) })),
}));
