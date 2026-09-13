import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useChunks } from '@/features/reader/api';
import { useThemeColors } from '@/theme/useThemeColors';

/**
 * Xem theo đoạn: danh sách chunk của tài liệu. Chạm một đoạn → Reader nhảy đúng trang và
 * highlight đúng vùng (tiêu chí thoát G1). Ở G2, trích dẫn trong câu trả lời đi cùng con đường này.
 */
export default function ChunksScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const chunks = useChunks(id);

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
        <Text className="type-uiMedium text-ink flex-1 text-center">{t('reader.chunks')}</Text>
        <View className="min-w-[44px]" />
      </View>

      {chunks.isPending ? (
        <ActivityIndicator className="mt-xxl text-ink" />
      ) : (
        <FlashList
          data={chunks.data ?? []}
          keyExtractor={(ch) => ch.id}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('reader.chunkOnPage', {
                page: item.page_no,
                tokens: item.token_count,
              })}
              onPress={() =>
                // Quay về Reader đang mở với tham số mới thay vì chồng thêm một Reader.
                router.dismissTo({
                  pathname: '/documents/[id]',
                  params: { id, page: String(item.page_no), chunk: item.id },
                })
              }
              className="mb-md rounded-card border border-rule bg-surface p-lg active:opacity-80"
            >
              <Text className="type-label text-ink-muted">
                {t('reader.chunkOnPage', { page: item.page_no, tokens: item.token_count })}
              </Text>
              <Text className="type-answerBody text-ink mt-xs" numberOfLines={4}>
                {item.text}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
