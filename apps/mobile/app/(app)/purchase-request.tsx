import { Redirect, useLocalSearchParams } from 'expo-router';

export default function PurchaseRequestLegacyRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (id) {
    return <Redirect href={{ pathname: '/(app)/purchase-request/[id]', params: { id } }} />;
  }
  return <Redirect href="/(app)/purchase-requests" />;
}
