export const DARK_COLORS = {
  primary: '#477DFF',
  primaryDark: '#2856C7',
  background: '#080F24',
  backgroundSecondary: '#0D1832',

  card: '#111E3A',
  surface: '#172746',
  surfaceLight: '#20365A',

  textPrimary: '#F5F8FF',
  textSecondary: '#A9B8D0',
  textOnPrimary: '#FFFFFF',

  border: '#2B4268',
  shadow: '#000000',

  warning: '#F5B942',
  success: '#38D9A9',
  danger: '#FF647C',

  glass: 'rgba(25, 45, 80, 0.72)',
  glassLight: 'rgba(255, 255, 255, 0.07)',
  glassBorder: 'rgba(150, 185, 255, 0.22)',
  overlay: 'rgba(4, 10, 25, 0.65)',
} as const;

export const LIGHT_COLORS = {
  primary: '#477DFF',
  primaryDark: '#2856C7',
  background: '#F4F7FF',
  backgroundSecondary: '#EAF0FF',

  card: '#FFFFFF',
  surface: '#F0F4FF',
  surfaceLight: '#DFE8FF',

  textPrimary: '#15213B',
  textSecondary: '#63718C',
  textOnPrimary: '#FFFFFF',

  border: '#D5DFF2',
  shadow: '#8294B5',

  warning: '#B77900',
  success: '#138A65',
  danger: '#D93652',

  glass: 'rgba(255, 255, 255, 0.88)',
  glassLight: 'rgba(71, 125, 255, 0.06)',
  glassBorder: 'rgba(71, 125, 255, 0.20)',
  overlay: 'rgba(21, 33, 59, 0.35)',
} as const;

// Keeps existing screens working until we connect the theme switch.
export const COLORS = DARK_COLORS;
