import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import React from 'react';
import { useColorScheme } from 'react-native';
import { Slot } from 'expo-router';
import { Provider } from '@ant-design/react-native';
// Added locale imports
import enUS from '@ant-design/react-native/lib/locale-provider/en_US';
import { COLORS } from '../theme/colors';

const theme = {
  brand_primary: COLORS.primary,
  brand_primary_tap: COLORS.primaryDark,
  primary_button_fill: COLORS.primary,
  primary_button_fill_tap: COLORS.primaryDark,
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  
  return (
    <Provider theme={theme} locale={enUS}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Slot />
      </ThemeProvider>
    </Provider>
  );
}
