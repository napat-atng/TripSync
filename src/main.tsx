import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import "@mantine/core/styles.css";
import "@fontsource-variable/anuphan";
import "./app/styles.css";
import { theme } from "./app/theme";
import { router } from "./app/router";
import { AuthProvider } from "./features/auth/AuthProvider";
import { DirtyFormsProvider } from "./app/DirtyFormsProvider";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 }, mutations: { retry: false } } });
createRoot(document.getElementById("root")!).render(<StrictMode><MantineProvider theme={theme} defaultColorScheme="light"><QueryClientProvider client={queryClient}><AuthProvider><DirtyFormsProvider><RouterProvider router={router} /></DirtyFormsProvider></AuthProvider></QueryClientProvider></MantineProvider></StrictMode>);
