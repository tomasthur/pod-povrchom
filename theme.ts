import { Platform } from "react-native";

export const fonts = {
  regular: "Montserrat_400Regular",
  medium: "Montserrat_500Medium",
  semiBold: "Montserrat_600SemiBold",
  bold: "Montserrat_700Bold",
  extraBold: "Montserrat_800ExtraBold",
  black: "Montserrat_900Black",
} as const;

export const colors = {
  bg: "#0a0a0f",
  surface: "#141420",
  surfaceBorder: "#1e1e2e",
  surfaceHover: "#1a1a2a",

  accent: "#e63946",
  accentDark: "#b91c2c",
  accentGlow: "rgba(230, 57, 70, 0.25)",

  amber: "#f4a261",
  amberDark: "#d4843a",
  amberGlow: "rgba(244, 162, 97, 0.2)",

  text: "#eaeaea",
  textSecondary: "#8888a0",
  textMuted: "#55556a",

  success: "#2dd4bf",
  successGlow: "rgba(45, 212, 191, 0.2)",
  error: "#ef4444",
  errorGlow: "rgba(239, 68, 68, 0.2)",

  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  heroTitle: {
    fontSize: 32,
    fontFamily: fonts.extraBold,
    color: colors.text,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
  },
  body: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.text,
    lineHeight: 21,
  },
  caption: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textMuted,
  },
  badge: {
    fontSize: 13,
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
  },
  button: {
    fontSize: 15,
    fontFamily: fonts.bold,
    letterSpacing: 0.3,
  },
} as const;

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    android: {
      elevation: 6,
    },
  }),
  glow: (color: string) =>
    Platform.select({
      ios: {
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
} as const;
