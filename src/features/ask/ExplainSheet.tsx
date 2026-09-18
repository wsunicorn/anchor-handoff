import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import type { VerifiedParagraph } from '@/features/ask/types';

type Props = {
  paragraph: VerifiedParagraph | null;
  onClose: () => void;
  onOpenCitation: (page: number, chunkId: string | null) => void;
};

/**
 * Bảng giải thích vì sao đoạn có nhãn này (G3.5): liệt kê từng câu, nhãn, điểm và trang trích dẫn.
 * Sheet là chỗ duy nhất được đổ bóng (DESIGN §5), bo góc 20pt.
 */
export function ExplainSheet({ paragraph, onClose, onOpenCitation }: Props) {
  const { t } = useTranslation();
  // DESIGN §6: "giảm chuyển động" → thay trượt bằng mờ dần.
  const reduced = useReducedMotion();
  return (
    <Modal
      visible={paragraph !== null}
      transparent
      animationType={reduced ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
        className="flex-1 justify-end bg-ink/40"
        onPress={onClose}
      >
        {/* Chặn chạm xuyên xuống lớp đóng; không phải nút với TalkBack. */}
        <Pressable
          accessibilityRole="none"
          onPress={() => {}}
          className="rounded-t-sheet bg-surface px-screen pb-xxl pt-lg shadow-lg"
        >
          <View className="mb-md h-[4px] w-[36px] self-center rounded-full bg-rule" />
          <Text className="type-sectionTitle text-ink">{t('verdict.explain')}</Text>
          <Text className="type-label text-ink-muted mt-xs">{t('verdict.explainHint')}</Text>
          <ScrollView className="mt-lg max-h-[420px]">
            {paragraph?.sentences.map((s, i) => (
              <View key={i} className="mb-md flex-row">
                <View
                  className={`mr-rail-gap w-[2px] ${s.verdict === 'grounded' ? 'bg-verified' : 'bg-inferred'}`}
                />
                <View className="flex-1">
                  <Text className="type-answerBody text-ink">{s.text}</Text>
                  <View className="mt-xs flex-row flex-wrap items-center gap-sm">
                    <Text
                      className={`type-label ${s.verdict === 'grounded' ? 'text-verified' : 'text-inferred'}`}
                    >
                      {t(`verdict.${s.verdict}`)} · {Math.round(s.score * 100)}%
                    </Text>
                    {s.citations.map((c) => (
                      <Pressable
                        key={c.code}
                        accessibilityRole="link"
                        onPress={() => onOpenCitation(c.page_no, c.chunk_id)}
                        className="min-h-[44px] justify-center"
                      >
                        <Text className="type-label text-ink-muted underline">
                          {t('ask.page', { page: c.page_no })}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
