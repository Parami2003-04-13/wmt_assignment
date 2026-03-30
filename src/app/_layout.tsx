import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import React from 'react';
import { useColorScheme } from 'react-native';
import { Slot } from 'expo-router';
import { Provider } from '@ant-design/react-native';
// Added locale imports
import enUS from '@ant-design/react-native/lib/locale-provider/en_US';

const ORANGE_PRIMARY = '#FF6F3C';

const theme = {
  brand_primary: ORANGE_PRIMARY,
  brand_primary_tap: '#E65A2B',
  primary_button_fill: ORANGE_PRIMARY,
  primary_button_fill_tap: '#E65A2B',
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
