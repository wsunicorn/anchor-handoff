import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { StudyError, useGenerateQuiz } from '@/features/study/api';
import { supabase } from '@/lib/supabase';
import { palette } from '@/theme/tokens';

/** Tạo bộ ôn tập từ một khoảng trang (G4.1). Sinh một lần, sau đó ôn ở tab Ôn tập (offline được). */
export default function GenerateQuizScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = palette[useColorScheme() === 'dark' ? 'dark' : 'light'];

  const doc = useQuery({
    queryKey: ['document', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, page_count')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const max = doc.data?.page_count ?? 0;

  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('');
  const [count, setCount] = useState('20');
  const [error, setError] = useState<string>();
  const gen = useGenerateQuiz();

  const toValue = to || String(Math.min(max, 20));

  const submit = () => {
    const f = Number(from);
    const tt = Number(toValue);
    const n = Number(count);
    if (!Number.isInteger(f) || !Number.isInteger(tt) || f < 1 || tt > max || tt < f) {
      setError(t('study.generate.invalidRange', { max }));
      return;
    }
    setError(undefined);
    gen.mutate(
      { document_id: id, from_page: f, to_page: tt, n: Math.min(30, Math.max(5, n || 20)) },
      {
        onError: (e) => {
          const code = e instanceof StudyError ? e.code : 'internal';
          setError(
            code === 'quota_exceeded'
              ? t('study.generate.quota')
              : code === 'no_content'
                ? t('study.generate.noContent')
                : code === 'consent_required'
                  ? t('ingestError.consent_required')
                  : t('study.generate.failed'),
          );
        },
      },
    );
  };

  const dropped = gen.data ? Object.values(gen.data.dropped).reduce((a, b) => a + b, 0) : 0;

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
          {t('study.generate.title')}
        </Text>
        <View className="min-w-[44px]" />
      </View>

      <ScrollView
        contentContainerClassName="px-screen py-lg gap-lg"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="type-sectionTitle text-ink">{doc.data?.title ?? ''}</Text>
        <Text className="type-ui text-ink-muted">{t('study.generate.body')}</Text>

        {gen.data ? (
          <View className="gap-md rounded-card border border-rule bg-surface p-lg">
            <Text className="type-uiMedium text-ink">
              {t('study.generate.done', { kept: gen.data.questions.length, dropped })}
            </Text>
            <Button
              label={t('study.generate.start')}
              testID="quiz-start"
              onPress={() =>
                router.replace({ pathname: '/study/session', params: { quiz: gen.data.quiz_id } })
              }
            />
          </View>
        ) : (
          <View className="gap-md">
            <View className="flex-row gap-md">
              <View className="flex-1">
                <TextField
                  label={t('study.generate.from')}
                  value={from}
                  onChangeText={(v) => setFrom(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  testID="quiz-from"
                  editable={!gen.isPending}
                />
              </View>
              <View className="flex-1">
                <TextField
                  label={t('study.generate.to')}
                  value={toValue}
                  onChangeText={(v) => setTo(v.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  testID="quiz-to"
                  editable={!gen.isPending}
                />
              </View>
            </View>
            <TextField
              label={t('study.generate.count')}
              testID="quiz-count"
              value={count}
              onChangeText={(v) => setCount(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              editable={!gen.isPending}
              error={error}
            />
            <Button
              label={t('study.generate.submit')}
              busyLabel={t('study.generate.busy')}
              busy={gen.isPending}
              disabled={!max}
              testID="quiz-submit"
              onPress={submit}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
