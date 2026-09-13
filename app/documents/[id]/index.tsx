import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, List, MessageSquareText } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { bboxesOf, type PageWithUrl, useChunks, usePages } from '@/features/reader/api';
import { PageView } from '@/features/reader/PageView';
import { useThemeColors } from '@/theme/useThemeColors';

/**
 * Màn Đọc (G1.7): cuộn dọc các trang bằng FlashList, zoom từng trang.
 * Tham số `page` + `chunk`: nhảy tới trang và tô highlight bbox của chunk (G1.8) —
 * đây là đích của mọi trích dẫn ở G2.
 */
export default function ReaderScreen() {
  const { id, page, chunk } = useLocalSearchParams<{ id: string; page?: string; chunk?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const pages = usePages(id);
  const chunks = useChunks(id);
  const listRef = useRef<FlashListRef<PageWithUrl>>(null);
  const [current, setCurrent] = useState(1);

  const targetPage = page ? Number(page) : undefined;
  const highlight = useMemo(() => {
    const row = chunk ? chunks.data?.find((ch) => ch.id === chunk) : undefined;
    return row ? { page: row.page_no, bboxes: bboxesOf(row) } : undefined;
  }, [chunk, chunks.data]);

  // Nhảy tới trang yêu cầu ngay khi có dữ liệu; không animation (DESIGN §6: chỉ một khoảnh khắc dàn dựng, ở G2).
  useEffect(() => {
    const target = highlight?.page ?? targetPage;
    if (!target || !pages.data?.length) return;
    const index = Math.min(Math.max(target - 1, 0), pages.data.length - 1);
    const timer = setTimeout(() => listRef.current?.scrollToIndex({ index, animated: false }), 50);
    return () => clearTimeout(timer);
  }, [highlight?.page, targetPage, pages.data?.length]);

  const total = pages.data?.length ?? 0;

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
          {total ? t('reader.page', { page: current, total }) : ''}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('ask.title')}
          onPress={() => router.push({ pathname: '/documents/[id]/ask', params: { id } })}
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <MessageSquareText color={c.ink} size={22} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('reader.chunks')}
          onPress={() => router.push({ pathname: '/documents/[id]/chunks', params: { id } })}
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <List color={c.ink} size={22} />
        </Pressable>
      </View>

      {pages.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator className="text-ink" />
          <Text className="type-label text-ink-muted mt-sm">{t('reader.loading')}</Text>
        </View>
      ) : total === 0 ? (
        <View className="flex-1 items-center justify-center px-screen">
          <Text className="type-ui text-ink-muted">{t('reader.noPages')}</Text>
        </View>
      ) : (
        <FlashList
          ref={listRef}
          data={pages.data}
          keyExtractor={(p) => p.id}
          // FlashList memo hoá item: highlight tới sau khi trang đã vẽ thì phải báo để vẽ lại.
          extraData={highlight}
          renderItem={({ item }) => (
            <PageView
              page={item}
              width={width}
              highlights={highlight?.page === item.page_no ? highlight.bboxes : []}
            />
          )}
          ItemSeparatorComponent={() => <View className="h-sm bg-paper" />}
          onViewableItemsChanged={({ viewableItems }) => {
            const first = viewableItems[0]?.item as PageWithUrl | undefined;
            if (first) setCurrent(first.page_no);
          }}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        />
      )}
    </SafeAreaView>
  );
}
