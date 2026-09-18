import { FlashList } from '@shopify/flash-list';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useEntitlement } from '@/features/billing/api';
import { useAiConsent } from '@/features/consent/api';
import {
  deleteDocument,
  type DocumentRow,
  useDocuments,
  useImportDocument,
  usePageProgress,
} from '@/features/library/api';
import { IngestError } from '@/lib/ingest';

/** Màn Thư viện (G1.6): danh sách tài liệu, nạp PDF, trạng thái xử lý và lỗi nói rõ việc gì. */
export default function LibraryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const docs = useDocuments();
  const importDoc = useImportDocument();
  const consent = useAiConsent();
  const ent = useEntitlement();
  // Người dùng bấm "Thêm" khi chưa đồng ý → mở màn đồng ý; đồng ý xong tự tiếp tục nạp.
  const pendingImport = useRef(false);
  const paywallShown = useRef(false);

  // Chạy khi Thư viện lấy lại focus (đóng màn đồng ý / paywall). Thứ tự: paywall cứng sau onboarding
  // (ADR-0001 §5) một lần cho tài khoản chưa dùng thử/chưa có gói, rồi mới tiếp tục việc nạp đang chờ.
  useFocusEffect(
    useCallback(() => {
      if (consent !== true) return;
      const fresh = ent.data?.entitlement === 'none' && !ent.data.trial_ends_at;
      if (fresh && !paywallShown.current) {
        paywallShown.current = true;
        router.push('/paywall');
        return;
      }
      if (pendingImport.current) {
        pendingImport.current = false;
        importDoc.mutate();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [consent, ent.data?.entitlement, ent.data?.trial_ends_at]),
  );

  const onAdd = () => {
    if (consent === undefined) return;
    if (!consent) {
      pendingImport.current = true;
      router.push('/consent');
      return;
    }
    importDoc.mutate();
  };

  const importError = importDoc.error;
  const errorText =
    importError instanceof IngestError
      ? t(`ingestError.${importError.code}` as 'ingestError.unknown', { limit: importError.limit })
      : importError
        ? t('ingestError.unknown')
        : null;

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <View className="px-screen pt-lg pb-sm">
        <Text className="type-screenTitle text-ink">{t('library.title')}</Text>
      </View>

      {docs.isPending ? (
        <ActivityIndicator className="mt-xxl text-ink" />
      ) : docs.data && docs.data.length > 0 ? (
        <FlashList
          data={docs.data}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96 }}
          renderItem={({ item }) => (
            <DocumentCard
              doc={item}
              onOpen={() => router.push({ pathname: '/documents/[id]', params: { id: item.id } })}
              onRetry={onAdd}
              onDelete={() =>
                Alert.alert(item.title, undefined, [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => void deleteDocument(item.id).then(() => docs.refetch()),
                  },
                ])
              }
            />
          )}
        />
      ) : (
        <View className="flex-1 justify-center px-screen">
          <Text className="type-docBody text-ink-muted text-center">{t('library.empty')}</Text>
        </View>
      )}

      <View className="absolute bottom-lg left-screen right-screen">
        {errorText ? (
          <Text className="type-label text-unsupported mb-sm" accessibilityLiveRegion="polite">
            {errorText}
          </Text>
        ) : null}
        <Button
          label={t('library.add')}
          busyLabel={t('library.parsing')}
          busy={importDoc.isPending}
          disabled={consent === undefined}
          onPress={onAdd}
        />
      </View>
    </SafeAreaView>
  );
}

function DocumentCard({
  doc,
  onOpen,
  onRetry,
  onDelete,
}: {
  doc: DocumentRow;
  onOpen: () => void;
  onRetry: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const busy = doc.status === 'pending' || doc.status === 'parsing' || doc.status === 'embedding';
  const progress = usePageProgress(doc.status === 'parsing' ? doc.id : null);

  let statusText: string;
  let statusClass = 'text-ink-muted';
  switch (doc.status) {
    case 'ready':
      statusText = t('libraryStatus.ready', { pages: doc.page_count });
      break;
    case 'parsing':
      statusText =
        progress.data !== undefined
          ? t('libraryStatus.parsing', { done: progress.data, total: doc.page_count })
          : t('libraryStatus.parsingShort');
      break;
    case 'embedding':
      statusText = t('libraryStatus.embedding');
      break;
    case 'failed':
      statusText =
        doc.error && doc.error in ERROR_KEYS
          ? t(`ingestError.${doc.error}` as 'ingestError.unknown')
          : t('libraryStatus.failed');
      statusClass = 'text-unsupported';
      break;
    default:
      statusText = t('libraryStatus.pending');
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${doc.title}. ${statusText}`}
      disabled={doc.status !== 'ready'}
      onPress={onOpen}
      onLongPress={onDelete}
      className="mb-md rounded-card border border-rule bg-surface p-lg active:opacity-80"
    >
      <Text className="type-sectionTitle text-ink" numberOfLines={2}>
        {doc.title}
      </Text>
      <View className="mt-xs flex-row items-center gap-sm">
        {busy ? <ActivityIndicator size="small" className="text-ink-muted" /> : null}
        <Text className={`type-label ${statusClass} flex-1`}>{statusText}</Text>
        {doc.status === 'failed' ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            className="min-h-[44px] justify-center"
          >
            <Text className="type-uiMedium text-ink">{t('libraryStatus.retry')}</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const ERROR_KEYS = { no_text_found: 1, pdf_encrypted: 1 } as const;
