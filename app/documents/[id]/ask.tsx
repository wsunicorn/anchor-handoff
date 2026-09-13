import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { AnswerView } from '@/features/ask/AnswerView';
import { ExplainSheet } from '@/features/ask/ExplainSheet';
import type { VerifiedParagraph } from '@/features/ask/types';
import { useAsk } from '@/features/ask/useAsk';
import { AskError } from '@/lib/askClient';
import { supabase } from '@/lib/supabase';
import { useThemeColors } from '@/theme/useThemeColors';

/**
 * Màn Hỏi (G2.6 + G3.4/G3.5). Chỉ vẽ `VerifiedAnswer` từ event `verified` — trong lúc chờ,
 * hiện "Đang tìm trong tài liệu…" chứ không hiện văn bản thô (CLAUDE.md quy tắc 2).
 */
export default function AskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const c = useThemeColors();
  const ask = useAsk(id);
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState('');
  const [explain, setExplain] = useState<VerifiedParagraph | null>(null);
  const quota = useQuery({
    queryKey: ['quota'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_question_quota').single();
      if (error) throw error;
      return data;
    },
  });

  const submit = () => {
    const q = question.trim();
    if (!q || ask.isPending) return;
    setAsked(q);
    ask.mutate(q);
  };

  const openCitation = (page: number, chunkId: string | null) => {
    setExplain(null);
    router.push({
      pathname: '/documents/[id]',
      params: { id, page: String(page), ...(chunkId ? { chunk: chunkId } : {}) },
    });
  };

  const error = ask.error;
  const errorText =
    error instanceof AskError
      ? error.code === 'quota_exceeded'
        ? t('ask.quotaExceeded', { quota: String(error.extra['quota'] ?? '') })
        : error.code === 'consent_required'
          ? t('ingestError.consent_required')
          : t('ask.askFailed')
      : error
        ? t('ask.askFailed')
        : null;

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
          {asked ? <Text className="type-uiMedium text-ink-muted mb-block">{asked}</Text> : null}
          {ask.isPending ? (
            <View className="flex-row items-center gap-sm">
              <ActivityIndicator className="text-ink" />
              <Text className="type-ui text-ink-muted">{t('ask.thinking')}</Text>
            </View>
          ) : errorText ? (
            <Text className="type-ui text-unsupported" accessibilityLiveRegion="polite">
              {errorText}
            </Text>
          ) : ask.data ? (
            <AnswerView
              answer={ask.data.answer}
              onOpenCitation={openCitation}
              onExplain={setExplain}
            />
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
            testID="ask-input"
            value={question}
            onChangeText={setQuestion}
            returnKeyType="send"
            onSubmitEditing={submit}
            editable={!ask.isPending}
          />
          <Button
            label={t('ask.send')}
            testID="ask-send"
            busyLabel={t('ask.thinking')}
            busy={ask.isPending}
            onPress={submit}
            disabled={!question.trim()}
          />
        </View>
      </KeyboardAvoidingView>

      <ExplainSheet
        paragraph={explain}
        onClose={() => setExplain(null)}
        onOpenCitation={openCitation}
      />
    </SafeAreaView>
  );
}
