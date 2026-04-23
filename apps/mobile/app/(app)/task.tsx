import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TaskLegacyRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (id) {
    return <Redirect href={{ pathname: '/(app)/task/[id]', params: { id } }} />;
  }
  return <Redirect href="/(app)/tasks" />;
}
