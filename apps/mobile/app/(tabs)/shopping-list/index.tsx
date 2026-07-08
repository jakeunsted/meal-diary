import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShoppingListItemRow } from '@/components/shopping-list/ShoppingListItem';
import { ShoppingListSkeleton } from '@/components/shopping-list/ShoppingListSkeleton';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import {
  buildShoppingListDepthMap,
  getShoppingListItemDepth,
} from '@/lib/shopping-list/shoppingListDrop';
import { useShoppingList } from '@/lib/shopping-list/useShoppingList';
import { useCurrentUser } from '@/lib/queries/profile';

export default function ShoppingListScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const userQuery = useCurrentUser();
  const shoppingList = useShoppingList(userQuery.data?.family_group_id);

  const hasListData = shoppingList.shoppingList !== null;
  const showSkeleton = shoppingList.loading && !hasListData;
  const showListLoading = shoppingList.isFetching && hasListData;

  const itemDepthMap = useMemo(() => {
    if (!shoppingList.shoppingList?.items) {
      return {};
    }
    return buildShoppingListDepthMap(shoppingList.shoppingList.items);
  }, [shoppingList.shoppingList?.items]);

  const handleRefresh = () => {
    void userQuery.refetch();
    void shoppingList.refresh();
  };

  const handleRetry = () => {
    void shoppingList.refresh();
  };

  return (
    <Box className="flex-1 bg-base">
      <ScrollView
        contentContainerClassName="pb-8"
        contentContainerStyle={{ paddingTop: insets.top + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={shoppingList.isFetching && !shoppingList.loading}
            onRefresh={handleRefresh}
            tintColor="#6366F1"
          />
        }
      >
        <Heading size="2xl" className="text-ice mb-4 text-center" testID="shopping-list-title">
          {t('shoppingList.title')}
        </Heading>

        {shoppingList.lastFetchError && !shoppingList.loading ? (
          <Box
            className="mx-4 mb-4 flex-row items-center justify-between rounded-xl bg-red-500/15 px-4 py-3"
            testID="shopping-list-load-error"
          >
            <Text className="text-red-400 flex-1 text-sm">{t('shoppingList.loadFailed')}</Text>
            <Button
              size="sm"
              variant="outline"
              onPress={handleRetry}
              testID="shopping-list-retry-button"
            >
              <ButtonText>{t('shoppingList.retry')}</ButtonText>
            </Button>
          </Box>
        ) : null}

        {showSkeleton ? (
          <ShoppingListSkeleton />
        ) : (
          <Box className="relative mx-4">
            <Box className={showListLoading ? 'opacity-50' : ''}>
              {shoppingList.activeItems.length > 0 ? (
                <Box className="overflow-hidden rounded-2xl bg-surface px-2 py-2">
                  {shoppingList.activeItems.map((item) => (
                    <ShoppingListItemRow
                      key={String(item.id)}
                      item={item}
                      depth={getShoppingListItemDepth(item, itemDepthMap)}
                    />
                  ))}
                </Box>
              ) : (
                <Box className="items-center rounded-2xl bg-surface px-4 py-8">
                  <Text className="text-violet text-center">{t('shoppingList.enterNewItem')}</Text>
                </Box>
              )}
            </Box>

            {showListLoading ? (
              <Box
                className="absolute inset-0 items-center justify-center"
                testID="shopping-list-loading"
              >
                <ActivityIndicator size="large" color="#6366F1" />
              </Box>
            ) : null}
          </Box>
        )}
      </ScrollView>
    </Box>
  );
}
