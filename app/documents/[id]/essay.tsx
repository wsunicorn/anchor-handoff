import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, ChevronLeft, Image as ImageIcon, Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import {
  type DisplayLevel,
  EssayError,
  type GradedComment,
  type GradeResult,
  type RubricCriterion,
  useGradeEssay,
  useTranscribe,
} from '@/features/essay/api';
import { palette } from '@/theme/tokens';

const WEIGHT_STEP = 5;

/**
 * Chấm tự luận (G5.1–G5.6). Nhập bài: gõ/dán hoặc chụp bài viết tay (ảnh → chữ, sửa được trước khi chấm).
 * Rubric 4 tiêu chí mặc định, trọng số sửa được. Kết quả: nhận xét neo vào từng đoạn, thanh neo màu
 * theo mức kiểm chứng (chỉ grounded/inferred — unsupported đã bị server ẩn), kèm trang nguồn.
 * Dòng "phản hồi tham khảo, không phải điểm chính thức" đứng đầu kết quả (quy tắc 4).
 */
export default function EssayScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = palette[useColorScheme() === 'dark' ? 'dark' : 'light'];

  const [body, setBody] = useState('');
  const [rubric, setRubric] = useState<RubricCriterion[]>(() => [
    { name: t('essay.rubricDefault.content'), weight: 40 },
    { name: t('essay.rubricDefault.coverage'), weight: 25 },
    { name: t('essay.rubricDefault.reasoning'), weight: 20 },
    { name: t('essay.rubricDefault.expression'), weight: 15 },
  ]);
  const [error, setError] = useState<string>();
  const transcribe = useTranscribe();
  const grade = useGradeEssay();

  const pickImage = async (camera: boolean) => {
    const perm = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    const uri = res.assets?.[0]?.uri;
    if (res.canceled || !uri) return;
    setError(undefined);
    transcribe.mutate(uri, {
      onSuccess: (text) => {
        if (!text) setError(t('essay.transcribeEmpty'));
        else setBody((b) => (b.trim() ? `${b.trim()}\n\n${text}` : text));
      },
      onError: () => setError(t('essay.transcribeFailed')),
    });
  };

  const submit = () => {
    if (body.trim().length < 40) {
      setError(t('essay.tooShort'));
      return;
    }
    setError(undefined);
    grade.mutate(
      { document_id: id, body: body.trim(), rubric },
      {
        onError: (e) => {
          const code = e instanceof EssayError ? e.code : 'internal';
          setError(
            code === 'quota_exceeded'
              ? t('essay.quota')
              : code === 'no_content'
                ? t('essay.noContent')
                : code === 'consent_required'
                  ? t('ingestError.consent_required')
                  : t('essay.failed'),
          );
        },
      },
    );
  };

  const bump = (i: number, d: number) =>
    setRubric((r) =>
      r.map((x, k) => (k === i ? { ...x, weight: Math.min(100, Math.max(0, x.weight + d)) } : x)),
    );

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
        <Text className="type-uiMedium text-ink flex-1 text-center">{t('essay.title')}</Text>
        <View className="min-w-[44px]" />
      </View>

      {grade.data ? (
        <Results
          result={grade.data}
          onOpenSource={(page, chunkId) =>
            router.push({
              pathname: '/documents/[id]',
              params: { id, page: String(page), chunk: chunkId },
            })
          }
          onReset={() => {
            grade.reset();
            setBody('');
          }}
        />
      ) : (
        // Edge-to-edge (SDK 57) không tự co ScrollView khi bàn phím lên → padding trên cả hai nền tảng.
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <ScrollView
            contentContainerClassName="px-screen py-lg gap-lg"
            keyboardShouldPersistTaps="handled"
          >
            <Text className="type-ui text-ink-muted">{t('essay.intro')}</Text>

            <View className="gap-xs">
              <Text className="type-label text-ink-muted">{t('essay.bodyLabel')}</Text>
              <TextInput
                testID="essay-body"
                accessibilityLabel={t('essay.bodyLabel')}
                value={body}
                onChangeText={setBody}
                placeholder={t('essay.bodyPlaceholder')}
                placeholderTextColor={c.inkMuted}
                multiline
                textAlignVertical="top"
                editable={!grade.isPending && !transcribe.isPending}
                className="type-docBody min-h-[200px] rounded-card border border-rule bg-surface px-md py-sm text-ink"
              />
              <View className="flex-row gap-sm">
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('essay.capture')}
                  testID="essay-capture"
                  onPress={() => void pickImage(true)}
                  disabled={transcribe.isPending}
                  className="min-h-[44px] flex-1 flex-row items-center justify-center gap-sm rounded-card border border-rule bg-surface px-md active:opacity-80"
                >
                  <Camera color={c.ink} size={18} />
                  <Text className="type-uiMedium text-ink">
                    {transcribe.isPending ? t('essay.transcribing') : t('essay.capture')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('essay.pick')}
                  onPress={() => void pickImage(false)}
                  disabled={transcribe.isPending}
                  className="min-h-[44px] min-w-[44px] items-center justify-center rounded-card border border-rule bg-surface active:opacity-80"
                >
                  <ImageIcon color={c.ink} size={18} />
                </Pressable>
              </View>
            </View>

            <View className="gap-sm">
              <Text className="type-label text-ink-muted">{t('essay.rubric')}</Text>
              {rubric.map((r, i) => (
                <View
                  key={r.name}
                  className="flex-row items-center rounded-card border border-rule bg-surface px-md py-xs"
                >
                  <Text className="type-ui text-ink flex-1">{r.name}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${r.name} −${WEIGHT_STEP}`}
                    onPress={() => bump(i, -WEIGHT_STEP)}
                    className="min-h-[44px] min-w-[44px] items-center justify-center"
                  >
                    <Minus color={c.ink} size={18} />
                  </Pressable>
                  <Text className="type-uiMedium text-ink w-[40px] text-center">{r.weight}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${r.name} +${WEIGHT_STEP}`}
                    onPress={() => bump(i, WEIGHT_STEP)}
                    className="min-h-[44px] min-w-[44px] items-center justify-center"
                  >
                    <Plus color={c.ink} size={18} />
                  </Pressable>
                </View>
              ))}
            </View>

            {error ? (
              <Text className="type-label text-unsupported" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
            <Button
              label={t('essay.grade')}
              busyLabel={t('essay.grading')}
              busy={grade.isPending}
              disabled={transcribe.isPending}
              testID="essay-submit"
              onPress={submit}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function Results({
  result,
  onOpenSource,
  onReset,
}: {
  result: GradeResult;
  onOpenSource: (page: number, chunkId: string) => void;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const { feedback, paragraphs } = result;
  const byParagraph = new Map<number, GradedComment[]>();
  for (const cm of feedback.comments) {
    const list = byParagraph.get(cm.essay_paragraph) ?? [];
    list.push(cm);
    byParagraph.set(cm.essay_paragraph, list);
  }
  const levelClass: Record<DisplayLevel, string> = {
    met: 'text-verified',
    partial: 'text-inferred',
    unmet: 'text-unsupported',
    unverified: 'text-ink-muted',
  };

  return (
    <ScrollView contentContainerClassName="px-screen py-lg gap-lg">
      {/* G5.6: dòng này đứng trước mọi nhận xét, không phải chú thích cuối trang. */}
      <Text className="type-uiMedium text-ink-muted" testID="essay-disclaimer">
        {t('essay.disclaimer')}
      </Text>

      <View className="gap-xs rounded-card border border-rule bg-surface p-lg">
        {feedback.criteria.map((cr) => (
          <View key={cr.name} className="flex-row items-center">
            <Text className="type-ui text-ink flex-1">
              {cr.name} <Text className="type-label text-ink-muted">· {cr.weight}</Text>
            </Text>
            <Text className={`type-uiMedium ${levelClass[cr.level]}`} testID={`level-${cr.level}`}>
              {t(`essay.levels.${cr.level}`)}
            </Text>
          </View>
        ))}
      </View>

      {paragraphs.map((p, i) => {
        const comments = byParagraph.get(i) ?? [];
        return (
          <View key={i} className="gap-sm">
            <Text className="type-label text-ink-muted">{t('essay.paragraph', { n: i + 1 })}</Text>
            <Text className="type-docBody text-ink">{p}</Text>
            {comments.length === 0 ? (
              <Text className="type-label text-ink-muted">{t('essay.noComment')}</Text>
            ) : (
              comments.map((cm, k) => (
                <View key={k} className="flex-row" testID={`comment-${cm.verdict}`}>
                  {/* Thanh neo 2pt theo mức kiểm chứng (DESIGN §4) — cùng ngôn ngữ với màn Hỏi. */}
                  <View
                    className={`w-[2px] ${cm.verdict === 'grounded' ? 'bg-verified' : 'bg-inferred'}`}
                  />
                  <View className="flex-1 gap-xs pl-rail-gap">
                    <Text className="type-label text-ink-muted">
                      {cm.criterion} · {t(`verdict.${cm.verdict}`)}
                    </Text>
                    <Text className="type-answerBody text-ink">{cm.comment}</Text>
                    {cm.evidence ? (
                      <Text className="type-label text-ink-muted">
                        {t('essay.evidence')}: {cm.evidence}
                      </Text>
                    ) : null}
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => onOpenSource(cm.citation.page_no, cm.citation.chunk_id)}
                      className="self-start"
                    >
                      <Text className="type-label text-ink underline">
                        {t('essay.source', { page: cm.citation.page_no })}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        );
      })}

      {feedback.omitted > 0 ? (
        <Text className="type-label text-ink-muted">
          {t('essay.omitted', { count: feedback.omitted })}
        </Text>
      ) : null}
      <Button label={t('essay.newEssay')} variant="secondary" onPress={onReset} />
    </ScrollView>
  );
}
