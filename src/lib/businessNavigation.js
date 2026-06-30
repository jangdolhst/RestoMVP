export const BUSINESS_NAV_ITEMS = [
  { path: '/pos', icon: 'LayoutGrid', labelKey: 'navigation.menu', exact: true },
  { path: '/pagos', icon: 'ClipboardList', labelKey: 'navigation.payments' },
  { path: '/finanzas', icon: 'WalletCards', labelKey: 'navigation.finance' },
  { path: '/settings', icon: 'Store', labelKey: 'navigation.myBusiness' },
];

export const shouldShowBusinessBottomNav = (pathname) =>
  BUSINESS_NAV_ITEMS.some((item) => (
    item.exact ? pathname === item.path : pathname.startsWith(item.path)
  ));
