import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Ôn tập — nội dung ở G4. Màn rỗng là lời mời làm việc (DESIGN §7). */
export default function StudyScreen() {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <View className="px-screen pt-lg">
        <Text className="type-screenTitle text-ink">{t('study.title')}</Text>
      </View>
      <View className="flex-1 justify-center px-screen">
        <Text className="type-docBody text-ink-muted text-center">{t('study.empty')}</Text>
      </View>
    </SafeAreaView>
  );
}
