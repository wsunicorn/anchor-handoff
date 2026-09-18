import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingState } from '@/components/ScreenState';
import { type CardListItem, useAllCards } from '@/features/study/api';
import { palette } from '@/theme/tokens';

/**
 * Danh sách mọi thẻ (G7.4: 500 thẻ cuộn mượt): FlashList, item cao cố định, không ảnh.
 * Đọc từ SQLite nên offline vẫn xem được.
 */
export default function CardsScreen() {
  const { t } = useTranslation();
  const c = palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const cards = useAllCards();
  // Một mốc thời gian cho cả danh sách (component phải thuần — không gọi Date.now trong render item).
  const now = cards.dataUpdatedAt || 0;

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <View className="flex-row items-center border-b border-rule bg-surface px-sm">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft color={c.ink} size={24} />
        </Pressable>
        <Text className="type-uiMedium text-ink flex-1 text-center">
          {t('study.allCards', { count: cards.data?.length ?? 0 })}
        </Text>
        <View className="min-w-[44px]" />
      </View>
      {cards.isPending ? (
        <LoadingState />
      ) : cards.error ? (
        <ErrorState onRetry={() => void cards.refetch()} />
      ) : cards.data.length === 0 ? (
        <EmptyState message={t('study.empty')} />
      ) : (
        <FlashList
          data={cards.data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CardRow item={item} now={now} />}
          testID="cards-list"
        />
      )}
    </SafeAreaView>
  );
}

function CardRow({ item, now }: { item: CardListItem; now: number }) {
  const { t } = useTranslation();
  const dueIn = Math.ceil((new Date(item.dueAt).getTime() - now) / 86_400_000);
  const due =
    item.state === 0
      ? t('study.cardNew')
      : dueIn <= 0
        ? t('study.cardDueNow')
        : t('study.cardDueIn', { count: dueIn });
  return (
    <View className="border-b border-rule bg-surface px-screen py-md">
      <Text className="type-ui text-ink" numberOfLines={2}>
        {item.stem}
      </Text>
      <Text className="type-label text-ink-muted mt-xs">
        {item.documentTitle} · {due}
      </Text>
    </View>
  );
}
