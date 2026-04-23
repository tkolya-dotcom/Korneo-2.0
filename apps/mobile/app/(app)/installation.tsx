import { Redirect, useLocalSearchParams } from 'expo-router';

export default function InstallationLegacyRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (id) {
    return <Redirect href={{ pathname: '/(app)/installation/[id]', params: { id } }} />;
  }
  return <Redirect href="/(app)/installations" />;
}
