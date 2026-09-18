import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ErrorState, LoadingState } from '@/components/ScreenState';
import { useProgress, useQuizzes, useSync } from '@/features/study/api';

/**
 * Ôn tập (G4.6–G4.8): tiến độ hôm nay, độ phủ theo bộ, nút ôn. Mọi số liệu đọc từ SQLite —
 * mất mạng vẫn hiện đúng; đồng bộ chạy nền khi mở tab (lỗi mạng chỉ hiện một dòng, không chặn).
 */
export default function StudyScreen() {
  const { t } = useTranslation();
  const quizzes = useQuizzes();
  const progress = useProgress();
  const sync = useSync();

  useFocusEffect(
    useCallback(() => {
      sync.mutate();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const offline = sync.data?.failed === -1;
  const p = progress.data;
  const dueTotal = p ? p.due + p.new : 0;

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <ScrollView contentContainerClassName="px-screen pt-lg pb-xxl gap-lg">
        <Text className="type-screenTitle text-ink">{t('study.title')}</Text>
        {offline ? <Text className="type-label text-ink-muted">{t('study.offline')}</Text> : null}

        {quizzes.isPending ? <LoadingState /> : null}
        {quizzes.error ? <ErrorState onRetry={() => void quizzes.refetch()} /> : null}
        {quizzes.data && quizzes.data.length === 0 ? (
          <View className="flex-1 justify-center py-xxl">
            <Text className="type-docBody text-ink-muted text-center">{t('study.empty')}</Text>
          </View>
        ) : null}

        {p && quizzes.data && quizzes.data.length > 0 ? (
          <View className="gap-sm rounded-card border border-rule bg-surface p-lg">
            <Text className="type-sectionTitle text-ink" testID="study-due">
              {dueTotal > 0 ? t('study.due', { count: dueTotal }) : t('study.allCaughtUp')}
            </Text>
            <Text className="type-label text-ink-muted">
              {t('study.streak', { count: p.streak })} ·{' '}
              {t('study.reviewedToday', { count: p.reviewedToday })}
            </Text>
            {dueTotal > 0 ? (
              <View className="mt-sm">
                <Button
                  label={t('study.reviewNow')}
                  testID="study-review-now"
                  onPress={() => router.push({ pathname: '/study/session', params: {} })}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {quizzes.data && quizzes.data.length > 0 ? (
          <View className="gap-sm">
            <Text className="type-label text-ink-muted">{t('study.coverage')}</Text>
            {quizzes.data.map((q) => {
              const scope = q.scope as { from_page?: number; to_page?: number };
              return (
                <Pressable
                  key={q.id}
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: '/study/session', params: { quiz: q.id } })
                  }
                  className="gap-xs rounded-card border border-rule bg-surface p-lg active:opacity-80"
                >
                  <Text className="type-uiMedium text-ink" numberOfLines={1}>
                    {q.documentTitle}
                  </Text>
                  <Text className="type-label text-ink-muted">
                    {t('study.quizScope', {
                      from: scope.from_page ?? '?',
                      to: scope.to_page ?? '?',
                      total: q.total,
                    })}
                    {q.due > 0 ? ` · ${t('study.quizDue', { count: q.due })}` : ''}
                  </Text>
                  <View className="mt-xs h-[4px] overflow-hidden rounded-card bg-paper">
                    <View
                      className="h-full bg-ink"
                      style={{ width: `${q.total ? Math.round((q.learned / q.total) * 100) : 0}%` }}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
