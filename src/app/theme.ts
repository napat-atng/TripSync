import { createTheme } from "@mantine/core";

export const theme = createTheme({
  primaryColor: "indigo",
  fontFamily: "'Anuphan Variable', sans-serif",
  headings: { fontFamily: "'Anuphan Variable', sans-serif", fontWeight: "600" },
  defaultRadius: "md",
  respectReducedMotion: true,
  components: {
    Button: { styles: { root: { minHeight: 44, whiteSpace: "normal" } } },
    TextInput: { styles: { input: { minHeight: 48 } } },
    Select: { styles: { input: { minHeight: 48 } } },
  },
});
