import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ErrorState, LoadingState } from '@/components/ScreenState';
import { gradeCard, type QueueItem, quizDocumentId, useQueue, useSync } from '@/features/study/api';
import { type FsrsState, type Grade4, preview } from '@/features/study/scheduler';
import { palette } from '@/theme/tokens';

const SWIPE_PX = 96;

/**
 * Phiên ôn (G4.6): một thẻ một màn. Mặt trước là đề + bốn lựa chọn; chọn xong thẻ lật sang mặt sau
 * (đúng/sai, giải thích, trang nguồn) và hiện bốn mức FSRS kèm khoảng cách kế tiếp. Vuốt phải = Được,
 * vuốt trái = Lại. Haptic khi chấm. "Giảm chuyển động" → lật bằng mờ dần 100ms (DESIGN §6).
 * Không mạng: hàng ôn và điểm đều ở SQLite.
 */
export default function SessionScreen() {
  const { t } = useTranslation();
  const { quiz } = useLocalSearchParams<{ quiz?: string }>();
  const c = palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const qc = useQueryClient();
  const sync = useSync();
  const queue = useQueue(quiz ?? null);

  // Hàng ôn lấy một lần khi vào phiên (query không tự refetch giữa phiên); thẻ còn đến hạn trong ngày
  // được nối thêm vào cuối (`requeued`) thay vì xếp lại hàng.
  const [requeued, setRequeued] = useState<QueueItem[]>([]);
  const items = useMemo(
    () => (queue.data ? [...queue.data, ...requeued] : null),
    [queue.data, requeued],
  );
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const current = items?.[index];
  const total = items?.length ?? 0;
  const intervals = useMemo(
    () =>
      current
        ? preview({ state: current.card.fsrsState as FsrsState, due_at: current.card.dueAt })
        : null,
    [current],
  );

  const reduced = useReducedMotion();
  const flip = useSharedValue(0);
  const dragX = useSharedValue(0);

  const frontStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: 1 - flip.value }
      : {
          transform: [
            { perspective: 1000 },
            { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` },
          ],
          backfaceVisibility: 'hidden',
        },
  );
  const backStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: flip.value }
      : {
          transform: [
            { perspective: 1000 },
            { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` },
          ],
          backfaceVisibility: 'hidden',
        },
  );
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }, { rotateZ: `${dragX.value / 40}deg` }],
  }));

  const choose = (key: string) => {
    if (picked || !current) return;
    setPicked(key);
    const ok = key === current.question.answerKey;
    void Haptics.notificationAsync(
      ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
    );
    flip.set(withTiming(1, { duration: reduced ? 100 : 320 }));
  };

  const grade = useCallback(
    (g: Grade4) => {
      if (!current || !items) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const updated = gradeCard(current.card, g);
      // "Lại" hoặc còn trong bước học ngắn hạn (due < 1 ngày) → thẻ quay lại cuối phiên để ôn tiếp.
      const dueSoon = new Date(updated.dueAt).getTime() - Date.now() < 24 * 3600_000;
      if (dueSoon) setRequeued((r) => [...r, { card: updated, question: current.question }]);
      setDone((d) => d + 1);
      setPicked(null);
      flip.set(0);
      dragX.set(0);
      setIndex((i) => i + 1);
    },
    [current, items, flip, dragX],
  );

  const finished = items !== null && index >= total;
  useEffect(() => {
    if (finished) {
      void qc.invalidateQueries({ queryKey: ['study'] });
      sync.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const pan = Gesture.Pan()
    .enabled(Boolean(picked))
    .onUpdate((e) => {
      dragX.set(e.translationX);
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_PX) {
        dragX.set(withTiming(400, { duration: 160 }, () => runOnJS(grade)('good')));
      } else if (e.translationX < -SWIPE_PX) {
        dragX.set(withTiming(-400, { duration: 160 }, () => runOnJS(grade)('again')));
      } else {
        dragX.set(withTiming(0, { duration: 160 }));
      }
    });

  const when = (g: Grade4) => {
    const m = intervals?.[g] ?? 0;
    return m < 60
      ? t('study.session.inMinutes', { count: Math.max(1, m) })
      : m < 24 * 60
        ? t('study.session.inHours', { count: Math.round(m / 60) })
        : t('study.session.inDays', { count: Math.round(m / (24 * 60)) });
  };

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
          {t('study.session.title')}
        </Text>
        <Text
          className="type-label text-ink-muted min-w-[44px] text-right"
          testID="session-progress"
        >
          {total ? t('study.session.progress', { done: Math.min(done, total), total }) : ''}
        </Text>
      </View>

      {queue.isPending ? (
        <LoadingState />
      ) : queue.error ? (
        <ErrorState onRetry={() => void queue.refetch()} />
      ) : finished || (items && !current) ? (
        <View className="flex-1 justify-center gap-md px-screen">
          <Text className="type-sectionTitle text-ink" testID="session-finished">
            {t('study.session.finished')}
          </Text>
          <Text className="type-ui text-ink-muted">
            {t('study.session.finishedBody', { count: done })}
          </Text>
          <Button label={t('study.session.back')} onPress={() => router.back()} />
        </View>
      ) : current ? (
        <View className="flex-1 px-screen py-lg">
          <GestureDetector gesture={pan}>
            <Animated.View style={cardStyle} className="flex-1">
              {/* Mặt trước */}
              <Animated.View
                style={frontStyle}
                pointerEvents={picked ? 'none' : 'auto'}
                className="absolute inset-0 gap-md rounded-card border border-rule bg-surface p-lg"
              >
                <Text className="type-docBody text-ink" testID="card-stem">
                  {current.question.stem}
                </Text>
                <View className="mt-sm gap-sm">
                  {Object.entries(current.question.options).map(([key, text]) => (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      testID={`option-${key}`}
                      onPress={() => choose(key)}
                      className="min-h-[44px] flex-row gap-sm rounded-card border border-rule px-md py-sm active:opacity-80"
                    >
                      <Text className="type-uiMedium text-ink">{key}.</Text>
                      <Text className="type-ui text-ink flex-1">{text}</Text>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>

              {/* Mặt sau */}
              <Animated.View
                style={backStyle}
                pointerEvents={picked ? 'auto' : 'none'}
                className="absolute inset-0 gap-md rounded-card border border-rule bg-surface p-lg"
              >
                <Text
                  className={`type-uiMedium ${
                    picked === current.question.answerKey ? 'text-verified' : 'text-unsupported'
                  }`}
                  testID="card-result"
                >
                  {picked === current.question.answerKey
                    ? t('study.session.correct')
                    : t('study.session.wrong', { key: current.question.answerKey })}
                </Text>
                <Text className="type-docBody text-ink">
                  {current.question.answerKey}.{' '}
                  {current.question.options[current.question.answerKey]}
                </Text>
                <Text className="type-answerBody text-ink-muted">
                  {current.question.explanation}
                </Text>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => {
                    const docId = quizDocumentId(current.question.quizId);
                    if (!docId) return;
                    router.push({
                      pathname: '/documents/[id]',
                      params: {
                        id: docId,
                        page: String(current.question.citation.page_no),
                        chunk: current.question.citation.chunk_id,
                      },
                    });
                  }}
                  className="self-start"
                >
                  <Text className="type-label text-ink underline">
                    {t('study.session.source', { page: current.question.citation.page_no })}
                  </Text>
                </Pressable>
                <View className="flex-1" />
                <Text className="type-label text-ink-muted text-center">
                  {t('study.session.swipeHint')}
                </Text>
                <View className="flex-row gap-sm">
                  {(['again', 'hard', 'good', 'easy'] as Grade4[]).map((g) => (
                    <Pressable
                      key={g}
                      accessibilityRole="button"
                      testID={`grade-${g}`}
                      onPress={() => grade(g)}
                      className={`min-h-[52px] flex-1 items-center justify-center rounded-card px-xs py-xs ${
                        g === 'good' ? 'bg-ink' : 'border border-rule bg-surface'
                      }`}
                    >
                      <Text
                        className={`type-uiMedium text-center ${g === 'good' ? 'text-paper' : 'text-ink'}`}
                      >
                        {t(`study.session.${g}`)}
                      </Text>
                      <Text
                        className={`type-label text-center ${g === 'good' ? 'text-paper' : 'text-ink-muted'}`}
                      >
                        {when(g)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
