import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { AnswerView } from '@/features/ask/AnswerView';
import { fixtureAnswer, fixtureInsufficient } from '@/features/ask/fixtures';
import type { VerifiedAnswer } from '@/features/ask/types';
import { useChunks } from '@/features/reader/api';
import { supabase } from '@/lib/supabase';
import { useThemeColors } from '@/theme/useThemeColors';

/**
 * Màn Hỏi (G2.6). Ở G2 chỉ hiển thị fixture theo kiểu `VerifiedAnswer` — stream thật nối vào
 * ở G3 sau verify() (CLAUDE.md quy tắc 2: dùng fixture, không tắt kiểm chứng). Hạn mức đọc
 * thật từ `my_question_quota()` (G2.8).
 */
export default function AskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const chunks = useChunks(id);
  const quota = useQuery({
    queryKey: ['quota'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_question_quota').single();
      if (error) throw error;
      return data;
    },
  });
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<VerifiedAnswer | null>(null);

  const ask = () => {
    const q = question.trim();
    if (!q) return;
    // Fixture: câu có chữ "không" ra từ chối để kiểm đường INSUFFICIENT; còn lại ra câu trả lời mẫu
    // trỏ vào hai chunk đầu của tài liệu thật để chạm trích dẫn nhảy đúng chỗ.
    const [a, b] = chunks.data ?? [];
    setAnswer(
      /không|not/i.test(q)
        ? fixtureInsufficient
        : fixtureAnswer(
            a?.page_no ?? 1,
            b?.page_no ?? a?.page_no ?? 1,
            a?.id ?? '',
            b?.id ?? a?.id ?? '',
          ),
    );
  };

  const openCitation = (page: number, chunkId: string | null) =>
    router.push({
      pathname: '/documents/[id]',
      params: { id, page: String(page), ...(chunkId ? { chunk: chunkId } : {}) },
    });

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top', 'bottom']}>
      <View className="flex-row items-center border-b border-rule bg-surface px-sm">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft color={c.ink} size={24} />
        </Pressable>
        <Text className="type-uiMedium text-ink flex-1 text-center">{t('ask.title')}</Text>
        <View className="min-w-[44px]" />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerClassName="px-screen py-lg" keyboardShouldPersistTaps="handled">
          {__DEV__ ? (
            <Text className="type-label text-inferred mb-md">{t('ask.fixtureNotice')}</Text>
          ) : null}
          {answer ? (
            <AnswerView answer={answer} onOpenCitation={openCitation} />
          ) : (
            <Text className="type-ui text-ink-muted">{t('ask.placeholder')}</Text>
          )}
        </ScrollView>

        <View className="border-t border-rule bg-surface px-screen py-md gap-sm">
          {quota.data ? (
            <Text className="type-label text-ink-muted">
              {t('ask.quota', {
                left: Math.max(quota.data.quota - quota.data.used, 0),
                quota: quota.data.quota,
              })}
            </Text>
          ) : null}
          <TextField
            label={t('ask.placeholder')}
            value={question}
            onChangeText={setQuestion}
            returnKeyType="send"
            onSubmitEditing={ask}
          />
          <Button label={t('ask.send')} onPress={ask} disabled={!question.trim()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
