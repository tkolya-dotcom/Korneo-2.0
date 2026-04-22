import { Platform } from 'react-native';
import Purchases, { CustomerInfo, LOG_LEVEL, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || '';
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY || '';
const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'pro';

let initializedUserId: string | null = null;

const getApiKey = () => {
  if (Platform.OS === 'ios') {
    return IOS_API_KEY;
  }
  if (Platform.OS === 'android') {
    return ANDROID_API_KEY;
  }
  return '';
};

export const subscriptionConfig = {
  entitlementId: ENTITLEMENT_ID,
  isConfigured: () => Boolean(getApiKey()),
};

export const initSubscriptions = async (appUserId?: string | null) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    return false;
  }

  if (!initializedUserId) {
    Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    Purchases.configure({
      apiKey,
      appUserID: appUserId || undefined,
    });
    initializedUserId = appUserId || '__anonymous__';
    return true;
  }

  if (appUserId && initializedUserId !== appUserId) {
    await Purchases.logIn(appUserId);
    initializedUserId = appUserId;
  }

  return true;
};

const hasEntitlement = (customerInfo: CustomerInfo) =>
  Boolean(customerInfo.entitlements.active[ENTITLEMENT_ID]);

export const getSubscriptionSnapshot = async () => {
  const configured = subscriptionConfig.isConfigured();
  if (!configured) {
    return {
      configured,
      isActive: false,
      customerInfo: null,
      offering: null,
      packages: [] as PurchasesPackage[],
    };
  }

  const [customerInfo, offerings] = await Promise.all([
    Purchases.getCustomerInfo(),
    Purchases.getOfferings(),
  ]);

  const offering = offerings.current ?? null;

  return {
    configured,
    isActive: hasEntitlement(customerInfo),
    customerInfo,
    offering,
    packages: offering?.availablePackages ?? [],
  };
};

export const purchaseSubscriptionPackage = async (pkg: PurchasesPackage) => {
  const result = await Purchases.purchasePackage(pkg);
  return {
    customerInfo: result.customerInfo,
    isActive: hasEntitlement(result.customerInfo),
  };
};

export const restoreSubscriptions = async () => {
  const customerInfo = await Purchases.restorePurchases();
  return {
    customerInfo,
    isActive: hasEntitlement(customerInfo),
  };
};

export type SubscriptionSnapshot = Awaited<ReturnType<typeof getSubscriptionSnapshot>>;
export type SubscriptionOffering = PurchasesOffering;
