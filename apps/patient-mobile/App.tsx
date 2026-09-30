import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { FontReadyContext, PatientLayout } from './src/PatientLayout';
import { theme } from './src/theme';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  if (!fontsLoaded && !fontError)
    return (
      <View
        style={styles.loading}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading Medora"
      >
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading Medora…</Text>
      </View>
    );
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <FontReadyContext.Provider value={fontsLoaded}>
        <PatientLayout />
      </FontReadyContext.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    padding: theme.space.xxl,
    gap: theme.space.lg,
  },
  loadingText: { color: theme.colors.muted, fontSize: theme.fontSize.small },
});
