import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import type { VerifiedAnswer, VerifiedParagraph } from '@/features/ask/types';

type Props = {
  answer: VerifiedAnswer;
  /** Chạm số trang → mở Reader đúng trang, highlight chunk. */
  onOpenCitation: (page: number, chunkId: string | null) => void;
  /** Chạm thanh neo → bảng giải thích mức tin cậy (G3.5). */
  onExplain?: (paragraph: VerifiedParagraph) => void;
};

/**
 * Khối văn bản do máy sinh — DESIGN §4: thanh neo dọc 2pt bên trái, cách chữ 12pt, màu theo
 * nhãn kiểm chứng; cuối thanh một gạch ngang 8pt chỉ về số trang. Không icon "AI", không gradient.
 * Chỉ nhận `VerifiedAnswer` — không có đường vào cho văn bản chưa kiểm chứng.
 */
export function AnswerView({ answer, onOpenCitation, onExplain }: Props) {
  const { t } = useTranslation();

  if (answer.insufficient) {
    return (
      <View className="gap-xs">
        <Text className="type-answerBody text-ink">{t('ask.insufficient')}</Text>
        {answer.nearestPage ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => onOpenCitation(answer.nearestPage!, null)}
            className="min-h-[44px] justify-center"
          >
            <Text className="type-label text-ink-muted">
              {t('ask.nearestSection', { page: answer.nearestPage })}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View className="gap-block">
      {answer.paragraphs.map((p, i) => (
        <AnchoredParagraph
          key={i}
          paragraph={p}
          onOpenCitation={onOpenCitation}
          onExplain={onExplain}
        />
      ))}
      {answer.omitted > 0 ? (
        <Text className="type-label text-ink-muted">
          {t('ask.omitted', { count: answer.omitted })}
        </Text>
      ) : null}
    </View>
  );
}

function AnchoredParagraph({
  paragraph,
  onOpenCitation,
  onExplain,
}: {
  paragraph: VerifiedParagraph;
  onOpenCitation: Props['onOpenCitation'];
  onExplain: Props['onExplain'];
}) {
  const { t } = useTranslation();
  const rail = paragraph.verdict === 'grounded' ? 'bg-verified' : 'bg-inferred';
  const tick = paragraph.verdict === 'grounded' ? 'bg-verified' : 'bg-inferred';
  const label = t(`verdict.${paragraph.verdict}`);

  return (
    <View className="flex-row">
      {/* Thanh neo: vùng chạm 44pt rộng nhưng vẽ 2pt. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${t('verdict.explain')}`}
        onPress={() => onExplain?.(paragraph)}
        className="w-[44px] -ml-md items-center"
      >
        <View className={`flex-1 w-[2px] ${rail}`} />
        <View className={`h-[2px] w-[8px] self-end mr-[10px] ${tick}`} />
      </Pressable>
      <View className="flex-1 pl-rail-gap">
        <Text className="type-answerBody text-ink">
          {paragraph.sentences.map((s) => s.text).join(' ')}
        </Text>
        <View className="mt-xs flex-row items-center gap-sm">
          {paragraph.verdict === 'inferred' && paragraph.page ? (
            <Text className="type-label text-inferred">
              {t('ask.inferredFrom', { page: paragraph.page })}
            </Text>
          ) : null}
          {paragraph.page ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t('ask.page', { page: paragraph.page })}
              onPress={() => onOpenCitation(paragraph.page!, paragraph.chunkId)}
              className="min-h-[44px] justify-center"
            >
              <Text className="type-label text-ink-muted underline">
                {t('ask.page', { page: paragraph.page })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}
