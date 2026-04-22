import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useAuth } from '@/src/providers/AuthProvider';
import { colors } from '@/src/theme/colors';
import {
  getSubscriptionSnapshot,
  initSubscriptions,
  purchaseSubscriptionPackage,
  restoreSubscriptions,
  subscriptionConfig,
  type SubscriptionSnapshot,
} from '@/src/lib/subscription';

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionSnapshot | null>(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [busyPackageId, setBusyPackageId] = useState<string | null>(null);

  const loadSubscription = async () => {
    setLoadingSubscription(true);
    try {
      await initSubscriptions(session?.user?.id);
      const snapshot = await getSubscriptionSnapshot();
      setSubscription(snapshot);
    } catch (error) {
      console.error('Failed to load subscription state:', error);
      setSubscription(null);
    } finally {
      setLoadingSubscription(false);
    }
  };

  useEffect(() => {
    loadSubscription();
  }, [session?.user?.id]);

  const onLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось выйти');
    }
  };

  const onRestore = async () => {
    try {
      setBusyPackageId('__restore__');
      await initSubscriptions(session?.user?.id);
      const result = await restoreSubscriptions();
      await loadSubscription();
      Alert.alert('Подписка', result.isActive ? 'Подписка восстановлена.' : 'Активная подписка не найдена.');
    } catch (error) {
      Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось восстановить подписку');
    } finally {
      setBusyPackageId(null);
    }
  };

  const onPurchase = async (pkg: NonNullable<SubscriptionSnapshot>['packages'][number]) => {
    try {
      setBusyPackageId(pkg.identifier);
      await initSubscriptions(session?.user?.id);
      const result = await purchaseSubscriptionPackage(pkg);
      await loadSubscription();
      Alert.alert('Подписка', result.isActive ? 'Подписка успешно активирована.' : 'Покупка завершена, entitlement пока не активен.');
    } catch (error) {
      Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось оформить подписку');
    } finally {
      setBusyPackageId(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} style={{ flex: 1, backgroundColor: colors.background }}>
      <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: '700' }}>Профиль</Text>

      <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 6 }}>
        <Text style={{ color: colors.textSecondary }}>Пользователь</Text>
        <Text style={{ color: colors.textPrimary, fontSize: 16 }}>{session?.user?.email || 'Не авторизован'}</Text>
      </View>

      <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 10 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>Подписка</Text>

        {loadingSubscription ? (
          <ActivityIndicator color={colors.accent} />
        ) : !subscriptionConfig.isConfigured() ? (
          <Text style={{ color: colors.textSecondary }}>
            RevenueCat не настроен. Добавьте `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` и `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`.
          </Text>
        ) : (
          <>
            <Text style={{ color: subscription?.isActive ? colors.accentSuccess : colors.textSecondary }}>
              {subscription?.isActive ? 'Подписка активна' : 'Подписка не активна'}
            </Text>

            {subscription?.packages?.length ? (
              subscription.packages.map((pkg) => (
                <Pressable
                  key={pkg.identifier}
                  onPress={() => onPurchase(pkg)}
                  style={{
                    backgroundColor: colors.accent,
                    borderRadius: 12,
                    padding: 12,
                    opacity: busyPackageId && busyPackageId !== pkg.identifier ? 0.6 : 1,
                  }}
                  disabled={Boolean(busyPackageId)}
                >
                  <Text style={{ color: colors.background, fontWeight: '700' }}>
                    {busyPackageId === pkg.identifier ? 'Обработка...' : `Оформить ${pkg.product.title}`}
                  </Text>
                  <Text style={{ color: colors.background }}>{pkg.product.priceString}</Text>
                </Pressable>
              ))
            ) : (
              <Text style={{ color: colors.textSecondary }}>Доступные тарифы пока не загружены.</Text>
            )}

            <Pressable
              onPress={onRestore}
              style={{
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                padding: 12,
                alignSelf: 'flex-start',
              }}
              disabled={Boolean(busyPackageId)}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>
                {busyPackageId === '__restore__' ? 'Восстановление...' : 'Восстановить покупки'}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <Pressable onPress={onLogout} style={{ backgroundColor: colors.danger, borderRadius: 10, padding: 12, alignSelf: 'flex-start' }}>
        <Text style={{ color: 'white', fontWeight: '700' }}>Выйти</Text>
      </Pressable>
    </ScrollView>
  );
}
