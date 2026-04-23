import { Redirect, useLocalSearchParams } from 'expo-router';

export default function ProjectLegacyRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (id) {
    return <Redirect href={{ pathname: '/(app)/project/[id]', params: { id } }} />;
  }
  return <Redirect href="/(app)/projects" />;
}
