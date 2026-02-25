<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
    NButton,
    NCard,
    NTable,
    NTag,
    NText,
    NFlex,
    NModal,
    NSelect,
    NIcon,
    NEmpty,
    useMessage,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import {
    SearchOutline,
    LinkOutline,
    DocumentTextOutline,
    CallOutline,
    LocationOutline,
    LogoAndroid,
    PersonOutline,
    DocumentAttachOutline,
    CodeSlashOutline,
    ImageOutline,
} from '@vicons/ionicons5';

import { submitJob } from '../services/jobSubmit';
import { useAdaptersStore } from '../stores/adapters';
import { useLicenseStore } from '../stores/license';
import { useRunsStore } from '../stores/runs';
import { useJobModalStore } from '../stores/jobModal';
import { useWsStore } from '../stores/ws';
import { useSettingsStore } from '../stores/settings';
import { type JobDraft } from '../services/capabilities';
import { base64ToHex } from '../utils/encoding';
import { useTransferStore } from '../stores/transfer';

import { Command } from 'nfc-jsclient/dist/models/commands';
import type { TagResource } from 'nfc-jsclient/dist/models/tags';
import type { NdefRecordResource, NdefResource } from 'nfc-jsclient/dist/models/ndefconv';

const message = useMessage();
const { t } = useI18n();
const adapters = useAdaptersStore();
const license = useLicenseStore();
const runs = useRunsStore();
const jobModal = useJobModalStore();
const ws = useWsStore();
const settings = useSettingsStore();
const router = useRouter();
const transfer = useTransferStore();

const isDark = computed(() => settings.theme === 'dark');

const sending = ref(false);
const lastJobId = ref('');

const lastRun = computed(() => {
    if (!adapters.selectedAdapterId) return null;
    return runs.lastRunByAdapterId[adapters.selectedAdapterId] ?? null;
});

const tags = ref<TagResource[]>([]);
const ndef = ref<NdefResource | null>(null);

const recordModalOpen = ref(false);
const selectedRecord = ref<NdefRecordResource | null>(null);

const canRead = computed(() => !!adapters.selectedAdapterId && !sending.value && ws.connected);

watch(
    () => lastRun.value,
    run => {
        if (!run) return;
        if (lastJobId.value && run.jobID !== lastJobId.value) return;

        const tagsStep = run.results.find(r => r.command === Command.GetTags);
        const readNdefStep = run.results.find(r => r.command === Command.ReadNdef);

        const tagsOut = (tagsStep?.output as any)?.tags as TagResource[] | undefined;
        tags.value = Array.isArray(tagsOut) ? tagsOut : [];

        const ndefOut = (readNdefStep?.output as any)?.ndef as NdefResource | undefined;
        ndef.value = ndefOut ?? null;
    },
    { deep: false },
);

async function onRead() {
    if (!adapters.selectedAdapterId) {
        message.error(t('app.selectAdapterFirst'));
        return;
    }

    const draft: JobDraft = {
        repeat: 1,
        steps: [
            { command: 'get_tags', params: {} },
            { command: 'read_ndef', params: {} },
        ],
    };

    sending.value = true;
    lastJobId.value = '';
    tags.value = [];
    ndef.value = null;

    try {
        const res = await submitJob({
            adapterId: adapters.selectedAdapterId,
            jobName: t('read.pageTitle'),
            draft,
            access: license.access,
            onWarning: w => message.warning(w),
        });
        if (!res.ok) {
            message.error(res.errorKey ? t(res.errorKey, res.errorParams ?? {}) : res.error);
            return;
        }
        lastJobId.value = res.jobId;
        message.success(t('common.jobSubmitted'));
        jobModal.openForJob({ adapterId: adapters.selectedAdapterId, jobId: res.jobId, jobName: t('read.pageTitle') });
    } catch (e) {
        message.error(e instanceof Error ? e.message : String(e));
    } finally {
        sending.value = false;
    }
}

function openRecord(r: NdefRecordResource) {
    selectedRecord.value = r;
    recordModalOpen.value = true;
}

const outputMode = ref<'compact' | 'json'>('compact');
const recordList = computed(() => ndef.value?.message ?? []);

const recordOptions = computed(() => [
    { label: t('read.compact'), value: 'compact' },
    { label: t('read.json'), value: 'json' },
]);

function recordLabel(r: NdefRecordResource): string {
    if (outputMode.value === 'json') return JSON.stringify(r);

    switch (r.type) {
        case 'url':
            return `url: ${(r as any).data?.url ?? ''}`;
        case 'uri':
            return `uri: ${(r as any).data?.uri ?? ''}`;
        case 'text':
            return `text: ${(r as any).data?.text ?? ''}`;
        case 'mime':
            return `mime: ${(r as any).data?.type ?? ''}`;
        default:
            return `${r.type}`;
    }
}

type RecordField = { value: string; label: string };

function recordIcon(type: string) {
    switch (type) {
        case 'url':
        case 'uri':
            return LinkOutline;
        case 'text':
            return DocumentTextOutline;
        case 'phone':
            return CallOutline;
        case 'geo':
            return LocationOutline;
        case 'aar':
            return LogoAndroid;
        case 'vcard':
            return PersonOutline;
        case 'mime':
            return DocumentAttachOutline;
        case 'raw':
            return CodeSlashOutline;
        case 'poster':
            return ImageOutline;
        default:
            return DocumentAttachOutline;
    }
}

function recordTitle(r: NdefRecordResource | null): string {
    if (!r) return '';
    const k = String(r.type || '').toLowerCase();
    const key = `recordModals.${k}.modal_title`;
    const translated = t(key);
    // vue-i18n returns key when missing
    if (translated === key) return k;
    return translated;
}

function langLabel(lang: unknown): string {
    const raw = String(lang ?? '').trim();
    if (!raw) return '–';
    const key = `languages.${raw.toLowerCase()}`;
    const translated = t(key);
    if (translated === key) return raw;
    return translated;
}

function fieldLabel(recordType: string, fieldKey: string): string {
    const type = String(recordType || '').toLowerCase();
    const key = `recordModals.${type}.${fieldKey}`;
    const translated = t(key);
    if (translated === key) return fieldKey;
    return translated;
}

function recordFields(r: NdefRecordResource | null): RecordField[] {
    if (!r) return [];

    const type = String(r.type || '').toLowerCase();
    const data: any = (r as any).data ?? {};

    const getFields = (): RecordField[] => {
        switch (type) {
            case 'text':
                return [
                    { value: String(data.text ?? '–'), label: fieldLabel(type, 'text') },
                    { value: langLabel(data.lang), label: fieldLabel(type, 'lang') },
                ];
            case 'url':
                return [{ value: String(data.url ?? '–'), label: fieldLabel(type, 'url') }];
            case 'uri':
                return [{ value: String(data.uri ?? '–'), label: fieldLabel(type, 'uri') }];
            case 'phone':
                return [{ value: String(data.phone_number ?? '–'), label: fieldLabel(type, 'phone_number') }];
            case 'geo':
                return [
                    { value: String(data.latitude ?? '–'), label: fieldLabel(type, 'latitude') },
                    { value: String(data.longitude ?? '–'), label: fieldLabel(type, 'longitude') },
                ];
            case 'aar':
                return [{ value: String(data.package_name ?? '–'), label: fieldLabel(type, 'package_name') }];
            case 'poster':
                return [
                    { value: String(data.title ?? '–'), label: fieldLabel(type, 'title') },
                    { value: String(data.uri ?? '–'), label: fieldLabel(type, 'uri') },
                ];
            case 'mime': {
                const content = data.format === 'ascii' ? String(data.content ?? '') : (data.content ? base64ToHex(String(data.content)) : '');
                return [
                    { value: String(data.type ?? '–'), label: fieldLabel(type, 'type') },
                    { value: String(data.format ?? '–'), label: fieldLabel(type, 'format') },
                    { value: content || '–', label: fieldLabel(type, 'content') },
                ];
            }
            case 'raw':
                return [
                    { value: String(data.tnf ?? '–'), label: fieldLabel(type, 'tnf') },
                    { value: String(data.type ?? '–'), label: fieldLabel(type, 'type') },
                    { value: String(data.id ?? '–'), label: fieldLabel(type, 'id') },
                    { value: data.payload ? base64ToHex(String(data.payload)) : '–', label: fieldLabel(type, 'payload') },
                ];
            case 'vcard': {
                const keys = [
                    'first_name',
                    'last_name',
                    'organization',
                    'title',
                    'email',
                    'phone_home',
                    'phone_work',
                    'phone_cell',
                    'site',
                    'address_country',
                    'address_postal_code',
                    'address_region',
                    'address_city',
                    'address_street',
                ];
                return keys.map(k => ({ value: String(data[k] ?? '–'), label: fieldLabel(type, k) }));
            }
            default:
                return Object.keys(data).map(k => ({ value: String(data[k] ?? '–'), label: fieldLabel(type, k) }));
        }
    };
    
    return getFields().filter(f => f.value && f.value.trim() !== '' && f.value !== '–');
}

function recordCompactParts(r: NdefRecordResource): string[] {
    const type = String(r.type || '').toLowerCase();
    const data: any = (r as any).data ?? {};
    switch (type) {
        case 'url':
            return [String(data.url ?? '')].filter(Boolean);
        case 'uri':
            return [String(data.uri ?? '')].filter(Boolean);
        case 'text':
            return [String(data.text ?? '')].filter(Boolean);
        case 'phone':
            return [String(data.phone_number ?? '')].filter(Boolean);
        case 'geo':
            return [
                [data.latitude, data.longitude].filter(Boolean).join(', '),
            ].filter(Boolean);
        case 'aar':
            return [String(data.package_name ?? '')].filter(Boolean);
        case 'poster':
            return [String(data.title ?? ''), String(data.uri ?? '')].filter(Boolean);
        case 'mime':
            return [String(data.type ?? ''), String(data.format ?? '')].filter(Boolean);
        case 'raw':
            return [String(data.type ?? ''), String(data.id ?? '')].filter(Boolean);
        case 'vcard':
            return [
                [data.first_name, data.last_name].filter(Boolean).join(' '),
                String(data.email ?? ''),
            ].filter(Boolean);
        default:
            return [type];
    }
}

function download(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function saveToFile() {
    if (!ndef.value?.message) return;
    
    // Convert base64 to hex for raw payloads and mime hex before saving to be fully compatible with Write page
    const records = JSON.parse(JSON.stringify(ndef.value.message));
    for (const r of records) {
        if (r.type === 'raw' && r.data?.payload) {
            r.data.payload = base64ToHex(r.data.payload);
        }
        if (r.type === 'mime' && r.data?.format === 'hex' && r.data?.content) {
            r.data.content = base64ToHex(r.data.content);
        }
    }
    
    download('records.nfc', JSON.stringify(records, null, 2), 'application/json;charset=utf-8');
}

function navigateToWrite() {
    if (!ndef.value?.message) return;
    
    // Convert base64 to hex for raw payloads and mime hex to be compatible with Write page
    const records = JSON.parse(JSON.stringify(ndef.value.message));
    for (const r of records) {
        if (r.type === 'raw' && r.data?.payload) {
            r.data.payload = base64ToHex(r.data.payload);
        }
        if (r.type === 'mime' && r.data?.format === 'hex' && r.data?.content) {
            r.data.content = base64ToHex(r.data.content);
        }
        r._id = Math.random().toString(36).substring(2, 9);
    }
    
    transfer.ndefRecords = records;
    router.push('/write');
}
</script>

<template>
    <div style="padding: 24px; display: flex; flex-direction: column; gap: 24px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 48px;">
            <div style="flex: 1; min-width: 0;">
                <h2 style="font-size: 16px; line-height: 24px; font-weight: 600; color: var(--n-text-color); margin: 0;">{{ t('read.pageTitle') }}</h2>
                <p style="font-size: 13px; line-height: 20px; color: var(--n-text-color-3); margin: 0; margin-top: 4px;">{{ t('read.pageDesc') }}</p>
            </div>
            <!-- Action -->
            <n-button
                type="primary"
                :disabled="!canRead"
                :loading="sending"
                @click="onRead"
                style="min-width: 120px"
            >
                {{ t('read.read') }}
            </n-button>
        </div>

        <div>

            <div style="margin-bottom: 16px;">
                <div style="margin-bottom: 16px;">
                    <h3 style="font-size: 14px; font-weight: 600; color: var(--n-text-color); margin: 0; text-transform: uppercase; letter-spacing: 0.025em;">
                        {{ t('read.tags') }}
                    </h3>
                </div>
                
                <n-empty v-if="!tags.length" :description="t('common.noData')" style="margin-top: 24px; margin-bottom: 16px;" />

                <n-flex v-else vertical size="small" style="margin-top: 12px;">
                    <div
                        v-for="tag in tags"
                        :key="tag.tag_id"
                        style="display: grid; grid-template-columns: 80px 1fr; gap: 8px 16px; margin-bottom: 16px;"
                    >
                        <n-text depth="3">{{ t('read.uid') }}</n-text>
                        <n-text>{{ tag.uid ? base64ToHex(tag.uid) : '–' }}</n-text>
                        
                        <n-text depth="3">{{ t('read.atr') }}</n-text>
                        <n-text>{{ tag.atr ? base64ToHex(tag.atr) : '–' }}</n-text>
                        
                        <n-text depth="3">{{ t('read.vendor') }}</n-text>
                        <n-text>{{ tag.vendor || '–' }}</n-text>
                        
                        <n-text depth="3">{{ t('read.product') }}</n-text>
                        <n-text>{{ tag.product || '–' }}</n-text>
                    </div>
                </n-flex>
            </div>

            <div v-if="ndef" style="margin-top: 32px">
                <n-flex vertical size="medium">
                    <n-flex align="center" justify="space-between" :wrap="false" style="margin-bottom: 8px;">
                        <n-flex align="center" :wrap="false" style="gap: 8px;">
                            <h3 style="font-size: 14px; font-weight: 600; color: var(--n-text-color); margin: 0; text-transform: uppercase; letter-spacing: 0.025em;">
                                {{ t('read.ndef') }}
                            </h3>
                            <n-tag :bordered="false" size="small" :type="ndef.read_only ? 'default' : 'success'" :style="ndef.read_only ? { borderRadius: '6px', backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#fafafc', color: 'var(--n-text-color-3)' } : { borderRadius: '6px' }">
                                {{ ndef.read_only ? t('read.accessReadOnly') : t('read.accessReadWrite') }}
                            </n-tag>
                        </n-flex>
                        <n-flex :wrap="false" align="center" style="gap: 8px;">
                            <n-button secondary size="small" @click="saveToFile">{{ t('common.save') }}</n-button>
                            <n-button secondary size="small" @click="navigateToWrite">{{ t('write.write') }}</n-button>
                        </n-flex>
                    </n-flex>

                    <n-table :bordered="false" :single-line="false" size="small" style="table-layout: fixed; width: 100%;">
                        <thead>
                            <tr>
                                <th style="width: 90px;">#</th>
                                <th>{{ t('read.content') }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="(r, idx) in recordList"
                                :key="idx"
                                @click="openRecord(r)"
                                style="cursor: pointer;"
                            >
                                <td style="white-space: nowrap;">{{ idx + 1 }}</td>
                                <td style="overflow: hidden;">
                                    <n-flex align="center" :wrap="false" style="gap: 10px; width: 100%; min-width: 0;">
                                        <n-icon size="18" style="flex-shrink: 0; color: var(--app-primary-color)">
                                            <component :is="recordIcon(r.type)" />
                                        </n-icon>
                                        <n-text style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;">
                                            {{ recordCompactParts(r).join(', ') || r.type }}
                                        </n-text>
                                    </n-flex>
                                </td>
                            </tr>
                        </tbody>
                    </n-table>
                </n-flex>
            </div>
        </div>

        <n-modal
            v-model:show="recordModalOpen"
            preset="card"
            style="width: 520px; max-width: calc(100vw - 48px);"
        >
            <template #header>
                <n-flex align="center" :wrap="false" style="gap: 12px">
                    <n-icon size="26">
                        <component :is="recordIcon(selectedRecord?.type || '')" />
                    </n-icon>
                    <div style="font-weight: 600; font-size: 16px;">{{ recordTitle(selectedRecord) }}</div>
                </n-flex>
            </template>
            <template #header-extra>
                <n-select v-model:value="outputMode" :options="recordOptions" size="small" style="width: 105px;" />
            </template>

            <template v-if="outputMode === 'json'">
                <pre style="white-space: pre-wrap; margin: 0">{{ selectedRecord ? JSON.stringify(selectedRecord, null, 2) : '' }}</pre>
            </template>
            <template v-else>
                <div v-for="(f, i) in recordFields(selectedRecord)" :key="i" style="margin-bottom: 18px;">
                    <div style="white-space: pre-wrap; word-break: break-word;">
                        {{ f.value }}
                    </div>
                    <n-text depth="3" style="display: block; margin-top: 2px; font-size: 12px;">
                        {{ f.label }}
                    </n-text>
                </div>

            </template>
        </n-modal>
    </div>
</template>
