<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import {
    NButton,
    NCard,
    NCheckbox,
    NDivider,
    NDropdown,
    NFlex,
    NForm,
    NFormItem,
    NIcon,
    NInput,
    NModal,
    NSelect,
    NText,
    NEmpty,
    useMessage,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { 
    CreateOutline, ChevronDownOutline, TrashOutline,
    LinkOutline, DocumentTextOutline, CallOutline, PersonOutline,
    LocationOutline, LogoAndroid, ImageOutline, DocumentOutline, HardwareChipOutline
} from '@vicons/ionicons5';
import draggable from 'vuedraggable';

import { submitJob } from '../services/jobSubmit';
import { useAdaptersStore } from '../stores/adapters';
import { useLicenseStore } from '../stores/license';
import { useRunsStore } from '../stores/runs';
import { useJobModalStore } from '../stores/jobModal';
import { useWsStore } from '../stores/ws';
import { useTransferStore } from '../stores/transfer';
import { type JobDraft } from '../services/capabilities';
import { cleanHex, hexToBase64 } from '../utils/encoding';

import { CommandStatus } from 'nfc-jsclient/dist/models/commands';
import type { NdefRecordResource } from 'nfc-jsclient/dist/models/ndefconv';

type RecordType = 'raw' | 'url' | 'text' | 'uri' | 'vcard' | 'mime' | 'phone' | 'geo' | 'aar' | 'poster';

type RecordDraft = {
    _id?: string;
    type: RecordType;
    data: any;
};

const message = useMessage();
const { t } = useI18n();
const adapters = useAdaptersStore();
const license = useLicenseStore();
const runs = useRunsStore();
const jobModal = useJobModalStore();
const ws = useWsStore();
const transfer = useTransferStore();

const records = ref<RecordDraft[]>([]);
const permanentLock = ref(false);
const sending = ref(false);
const lastJobId = ref('');

const modalOpen = ref(false);
const editIndex = ref<number | null>(null);
const draftType = ref<RecordType>('text');
const draftData = ref<any>({});

const lastRun = computed(() => {
    if (!adapters.selectedAdapterId) return null;
    return runs.lastRunByAdapterId[adapters.selectedAdapterId] ?? null;
});

const resultsText = ref('');

const canWrite = computed(() => !!adapters.selectedAdapterId && !sending.value && ws.connected);

const typeOptions = computed(() => [
    { label: t('recordModals.raw.modal_title'), value: 'raw', key: 'raw' },
    { label: t('recordModals.url.modal_title'), value: 'url', key: 'url' },
    { label: t('recordModals.text.modal_title'), value: 'text', key: 'text' },
    { label: t('recordModals.uri.modal_title'), value: 'uri', key: 'uri' },
    { label: t('recordModals.vcard.modal_title'), value: 'vcard', key: 'vcard' },
    { label: t('recordModals.mime.modal_title'), value: 'mime', key: 'mime' },
    { label: t('recordModals.phone.modal_title'), value: 'phone', key: 'phone' },
    { label: t('recordModals.geo.modal_title'), value: 'geo', key: 'geo' },
    { label: t('recordModals.aar.modal_title'), value: 'aar', key: 'aar' },
    { label: t('recordModals.poster.modal_title'), value: 'poster', key: 'poster' },
]);

const tnfOptions = [
    { label: 'Empty', value: 0 },
    { label: 'Well-Known', value: 1 },
    { label: 'MIME media-type', value: 2 },
    { label: 'Absolute URI', value: 3 },
    { label: 'External', value: 4 },
    { label: 'Unknown', value: 5 },
    { label: 'Unchanged', value: 6 },
    { label: 'Reserved', value: 7 },
];

const langOptions = computed(() => [
    { label: t('languages.english'), value: 'en' },
    { label: t('languages.arabic'), value: 'ar' },
    { label: t('languages.bengali'), value: 'bn' },
    { label: t('languages.chinese'), value: 'zh' },
    { label: t('languages.danish'), value: 'da' },
    { label: t('languages.dutch'), value: 'nl' },
    { label: t('languages.finnish'), value: 'fi' },
    { label: t('languages.french'), value: 'fr' },
    { label: t('languages.german'), value: 'de' },
    { label: t('languages.greek'), value: 'el' },
    { label: t('languages.hebrew'), value: 'he' },
    { label: t('languages.hindi'), value: 'hi' },
    { label: t('languages.irish'), value: 'ga' },
    { label: t('languages.italian'), value: 'it' },
    { label: t('languages.japanese'), value: 'ja' },
    { label: t('languages.latin'), value: 'la' },
    { label: t('languages.portuguese'), value: 'pt' },
    { label: t('languages.russian'), value: 'ru' },
    { label: t('languages.spanish'), value: 'es' },
]);

const mimeFormatOptions = [
    { label: 'Hex', value: 'hex' },
    { label: 'ASCII', value: 'ascii' },
];

function defaultDataFor(type: RecordType): any {
    switch (type) {
        case 'raw':
            return { tnf: 1, type: '', id: '', payload: '' }; // payload: HEX in UI
        case 'url':
            return { url: '' };
        case 'text':
            return { text: '', lang: 'en' };
        case 'uri':
            return { uri: '' };
        case 'vcard':
            return {
                first_name: '',
                last_name: '',
                organization: '',
                title: '',
                phone_cell: '',
                phone_home: '',
                phone_work: '',
                email: '',
                site: '',
                address_street: '',
                address_city: '',
                address_region: '',
                address_postal_code: '',
                address_country: '',
            };
        case 'mime':
            return { type: 'text/plain', format: 'ascii', content: '' };
        case 'phone':
            return { phone_number: '' };
        case 'geo':
            return { latitude: '', longitude: '' };
        case 'aar':
            return { package_name: '' };
        case 'poster':
            return { title: '', uri: '' };
        default:
            return {};
    }
}

function openAdd(type: string | number = 'text') {
    editIndex.value = null;
    draftType.value = type as RecordType;
    draftData.value = defaultDataFor(type as RecordType);
    modalOpen.value = true;
}

function openEdit(index: number) {
    const r = records.value[index];
    editIndex.value = index;
    draftType.value = r.type;
    draftData.value = JSON.parse(JSON.stringify(r.data));
    modalOpen.value = true;
}

function remove(index: number) {
    records.value.splice(index, 1);
}

function getRecordIcon(type: RecordType) {
    switch (type) {
        case 'url':
        case 'uri': return LinkOutline;
        case 'text': return DocumentTextOutline;
        case 'phone': return CallOutline;
        case 'vcard': return PersonOutline;
        case 'geo': return LocationOutline;
        case 'aar': return LogoAndroid;
        case 'poster': return ImageOutline;
        case 'mime': return DocumentOutline;
        case 'raw':
        default: return HardwareChipOutline;
    }
}

function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= records.value.length) return;
    const copy = records.value.slice();
    const tmp = copy[index];
    copy[index] = copy[next];
    copy[next] = tmp;
    records.value = copy;
}

function saveDraft() {
    let parsed: any;
    try {
        parsed = JSON.parse(JSON.stringify(draftData.value));
    } catch (e) {
        message.error(t('write.invalidJson'));
        return;
    }

    const _id = editIndex.value === null ? Math.random().toString(36).substring(2, 9) : records.value[editIndex.value]._id;
    const r: RecordDraft = { _id, type: draftType.value, data: parsed };
    if (editIndex.value === null) {
        records.value.push(r);
    } else {
        records.value[editIndex.value] = r;
    }
    modalOpen.value = false;
}

function onTypeUpdate(t: RecordType) {
    draftType.value = t;
    draftData.value = defaultDataFor(t);
}

function recordSummary(r: RecordDraft): string {
    switch (r.type) {
        case 'url':
            return r.data?.url ? String(r.data.url) : '';
        case 'uri':
            return r.data?.uri ? String(r.data.uri) : '';
        case 'text':
            return r.data?.text ? String(r.data.text).slice(0, 40) : '';
        case 'mime':
            return [r.data?.type, r.data?.format].filter(Boolean).join(', ');
        case 'aar':
            return r.data?.package_name ? String(r.data.package_name) : '';
        case 'phone':
            return r.data?.phone_number ? String(r.data.phone_number) : '';
        case 'geo':
            return r.data?.latitude && r.data?.longitude ? `${r.data.latitude}, ${r.data.longitude}` : '';
        case 'vcard':
            return `${r.data?.first_name ?? ''} ${r.data?.last_name ?? ''}`.trim();
        case 'poster':
            return [r.data?.title, r.data?.uri].filter(Boolean).join(', ');
        case 'raw':
            return [r.data?.type, r.data?.id].filter(Boolean).join(', ');
        default:
            return '';
    }
}

function serializeForApi(message: RecordDraft[]): NdefRecordResource[] {
    const cloned: any[] = JSON.parse(JSON.stringify(message));

    for (const r of cloned) {
        if (r?.type === 'raw' && r?.data?.payload) {
            // UI stores HEX; API expects base64
            r.data.payload = hexToBase64(String(r.data.payload));
        }
        if (r?.type === 'mime' && r?.data?.format === 'hex' && r?.data?.content) {
            const hex = cleanHex(String(r.data.content).split(/\r?\n/).join(' '));
            r.data.content = hexToBase64(hex);
        }
    }

    return cloned as NdefRecordResource[];
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
const fileInputRef = ref<HTMLInputElement | null>(null);

function triggerFileInput() {
    fileInputRef.value?.click();
}

function saveToFile() {
    const toSave = records.value.map(r => {
        const { _id, ...rest } = r;
        return rest;
    });
    download('records.nfc', JSON.stringify(toSave, null, 2), 'application/json;charset=utf-8');
}

async function loadFromFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
            message.error(t('write.invalidFileArray'));
            return;
        }
        for (const r of parsed) {
            if (!r._id) r._id = Math.random().toString(36).substring(2, 9);
        }
        records.value = parsed;
        message.success(t('write.loadedRecords'));
    } catch (e) {
        message.error(e instanceof Error ? e.message : String(e));
    } finally {
        input.value = '';
    }
}

watch(
    () => lastRun.value,
    run => {
        if (!run) return;
        if (lastJobId.value && run.jobID !== lastJobId.value) return;

        const lines: string[] = [];
        for (const r of run.results) {
            const status = r.status === CommandStatus.Success ? 'success' : r.status === CommandStatus.Error ? `error: ${r.message}` : 'unknown';
            lines.push(`${String((r as any).command)}: ${status}`);
        }
        resultsText.value = lines.join('\r\n');
    },
    { deep: false },
);

async function onWrite() {
    if (!adapters.selectedAdapterId) {
        message.error(t('app.selectAdapterFirst'));
        return;
    }
    if (records.value.length === 0) {
        message.error(t('write.emptyRecords'));
        return;
    }

    let messageForApi: NdefRecordResource[];
    try {
        messageForApi = serializeForApi(records.value);
    } catch (e) {
        message.error(e instanceof Error ? e.message : String(e));
        return;
    }

    const steps = [
        {
            command: 'write_ndef',
            params: {
                message: messageForApi,
            },
        },
        ...(permanentLock.value
            ? [
                  {
                      command: 'lock_permanent',
                      params: {},
                  },
              ]
            : []),
    ];

    const draft: JobDraft = {
        repeat: 0,
        steps,
    };

    sending.value = true;
    lastJobId.value = '';
    resultsText.value = '';
    try {
        const res = await submitJob({
            adapterId: adapters.selectedAdapterId,
            jobName: t('write.pageTitle'),
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
        jobModal.openForJob({ adapterId: adapters.selectedAdapterId, jobId: res.jobId, jobName: t('write.pageTitle') });
    } catch (e) {
        message.error(e instanceof Error ? e.message : String(e));
    } finally {
        sending.value = false;
    }
}

onMounted(() => {
    const transferred = transfer.takeRecords();
    if (transferred && Array.isArray(transferred) && transferred.length > 0) {
        records.value = transferred;
    }
});
</script>

<template>
    <div style="padding: 24px; display: flex; flex-direction: column; gap: 24px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 48px;">
            <div style="flex: 1; min-width: 0;">
                <h2 style="font-size: 16px; line-height: 24px; font-weight: 600; color: var(--n-text-color); margin: 0;">{{ t('write.pageTitle') }}</h2>
                <p style="font-size: 13px; line-height: 20px; color: var(--n-text-color-3); margin: 0; margin-top: 4px;">{{ t('write.pageDesc') }}</p>
            </div>
            <!-- Action -->
            <n-button
                type="primary"
                :disabled="!canWrite"
                :loading="sending"
                @click="onWrite"
                style="min-width: 120px"
            >
                {{ t('write.write') }}
            </n-button>
        </div>

        <div>

            <div style="margin-bottom: 16px;">
                <h3 style="font-size: 14px; font-weight: 600; color: var(--n-text-color); margin: 0; text-transform: uppercase; letter-spacing: 0.025em;">
                    {{ t('write.recordsSubtitle') }}
                </h3>
            </div>
            
            <n-flex align="center" :wrap="true" style="gap: 8px; margin-bottom: 24px;">
                <n-dropdown trigger="click" :options="typeOptions" @select="openAdd">
                    <n-button secondary>
                        {{ t('write.addRecordDropdown') }} 
                        <n-icon style="margin-left: 4px"><ChevronDownOutline /></n-icon>
                    </n-button>
                </n-dropdown>
                <n-button secondary @click="triggerFileInput">{{ t('common.load') }}</n-button>
                <input ref="fileInputRef" type="file" accept=".nfc,application/json" style="display:none" @change="loadFromFile" />
                <n-button secondary :disabled="records.length === 0" @click="saveToFile">{{ t('common.save') }}</n-button>
            </n-flex>

            <n-empty v-if="records.length === 0" :description="t('write.noRecords')" style="margin-top: 32px; margin-bottom: 32px;" />

            <div v-else style="margin-bottom: 32px;">
                <draggable 
                    v-model="records" 
                    item-key="_id" 
                    handle=".drag-handle"
                    animation="200"
                    group="records"
                >
                    <template #item="{ element: r, index: idx }">
                        <n-card size="small" :bordered="false" style="background-color: var(--n-color-embedded); margin-bottom: 8px;">
                            <n-flex align="center" justify="space-between" :wrap="false">
                                <n-flex align="center" :wrap="false" style="gap: 12px">
                                    <n-icon class="drag-handle" style="cursor: grab; color: #bbb" size="18">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                            <circle cx="9" cy="6" r="1.5" fill="currentColor" />
                                            <circle cx="9" cy="12" r="1.5" fill="currentColor" />
                                            <circle cx="9" cy="18" r="1.5" fill="currentColor" />
                                            <circle cx="15" cy="6" r="1.5" fill="currentColor" />
                                            <circle cx="15" cy="12" r="1.5" fill="currentColor" />
                                            <circle cx="15" cy="18" r="1.5" fill="currentColor" />
                                        </svg>
                                    </n-icon>
                                    <n-icon size="18" style="margin-right: -4px; color: var(--app-primary-color)"><component :is="getRecordIcon(r.type)" /></n-icon>
                                    <div style="width: 170px; flex-shrink: 0;"><n-text strong>{{ t('recordModals.' + r.type + '.modal_title') }}</n-text></div>
                                    <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><n-text depth="3">{{ recordSummary(r) }}</n-text></div>
                                </n-flex>

                                <n-flex :wrap="false" style="gap: 6px">
                                    <n-button text style="font-size: 18px" @click="openEdit(idx)">
                                        <n-icon><CreateOutline /></n-icon>
                                    </n-button>
                                    <n-button text style="font-size: 18px" @click="remove(idx)">
                                        <n-icon><TrashOutline /></n-icon>
                                    </n-button>
                                </n-flex>
                            </n-flex>
                        </n-card>
                    </template>
                </draggable>
            </div>

            <div style="margin-bottom: 16px;">
                <h3 style="font-size: 14px; font-weight: 600; color: var(--n-text-color); margin: 0; text-transform: uppercase; letter-spacing: 0.025em;">
                    {{ t('write.settingsSubtitle') }}
                </h3>
            </div>
            <n-checkbox v-model:checked="permanentLock">{{ t('write.permanentLock') }}</n-checkbox>
        </div>

        <n-modal v-model:show="modalOpen" preset="card" :title="t('write.modalTitle')" style="width: 720px">
            <n-form label-placement="top">
                <n-form-item :label="t('write.type')">
                    <n-select :value="draftType" :options="typeOptions" @update:value="onTypeUpdate" />
                </n-form-item>

                <template v-if="draftType === 'text'">
                    <n-form-item :label="t('recordModals.text.lang')">
                        <n-select v-model:value="draftData.lang" :options="langOptions" />
                    </n-form-item>
                    <n-form-item :label="t('recordModals.text.text')">
                        <n-input v-model:value="draftData.text" type="textarea" :autosize="{ minRows: 3, maxRows: 6 }" :placeholder="t('recordModals.text.placeholder')" />
                    </n-form-item>
                </template>

                <template v-else-if="draftType === 'url'">
                    <n-form-item :label="t('recordModals.url.url')">
                        <n-input v-model:value="draftData.url" :placeholder="t('recordModals.url.placeholder')" />
                    </n-form-item>
                </template>

                <template v-else-if="draftType === 'uri'">
                    <n-form-item :label="t('recordModals.uri.uri')">
                        <n-input v-model:value="draftData.uri" :placeholder="t('recordModals.uri.placeholder')" />
                    </n-form-item>
                </template>

                <template v-else-if="draftType === 'phone'">
                    <n-form-item :label="t('recordModals.phone.phone_number')">
                        <n-input v-model:value="draftData.phone_number" :placeholder="t('recordModals.phone.placeholder')" />
                    </n-form-item>
                </template>

                <template v-else-if="draftType === 'geo'">
                    <n-form-item :label="t('recordModals.geo.latitude')">
                        <n-input v-model:value="draftData.latitude" :placeholder="t('recordModals.geo.lat_placeholder')" />
                    </n-form-item>
                    <n-form-item :label="t('recordModals.geo.longitude')">
                        <n-input v-model:value="draftData.longitude" :placeholder="t('recordModals.geo.long_placeholder')" />
                    </n-form-item>
                </template>

                <template v-else-if="draftType === 'aar'">
                    <n-form-item :label="t('recordModals.aar.package_name')">
                        <n-input v-model:value="draftData.package_name" :placeholder="t('recordModals.aar.placeholder')" />
                    </n-form-item>
                </template>

                <template v-else-if="draftType === 'poster'">
                    <n-form-item :label="t('recordModals.poster.title')">
                        <n-input v-model:value="draftData.title" :placeholder="t('recordModals.poster.title_placeholder')" />
                    </n-form-item>
                    <n-form-item :label="t('recordModals.poster.uri')">
                        <n-input v-model:value="draftData.uri" :placeholder="t('recordModals.poster.uri_placeholder')" />
                    </n-form-item>
                </template>

                <template v-else-if="draftType === 'mime'">
                    <n-form-item :label="t('recordModals.mime.type')">
                        <n-input v-model:value="draftData.type" :placeholder="t('recordModals.mime.type_placeholder')" />
                    </n-form-item>
                    <n-form-item :label="t('recordModals.mime.format')">
                        <n-select v-model:value="draftData.format" :options="mimeFormatOptions" />
                    </n-form-item>
                    <n-form-item :label="t('recordModals.mime.content')">
                        <n-input v-model:value="draftData.content" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" :placeholder="t('recordModals.mime.content_placeholder')" />
                    </n-form-item>
                </template>

                <template v-else-if="draftType === 'raw'">
                    <n-form-item :label="t('recordModals.raw.tnf')">
                        <n-select v-model:value="draftData.tnf" :options="tnfOptions" />
                    </n-form-item>
                    <n-form-item :label="t('recordModals.raw.type')">
                        <n-input v-model:value="draftData.type" :placeholder="t('recordModals.raw.type_placeholder')" />
                    </n-form-item>
                    <n-form-item :label="t('recordModals.raw.id')">
                        <n-input v-model:value="draftData.id" :placeholder="t('recordModals.raw.id_placeholder')" />
                    </n-form-item>
                    <n-form-item :label="t('recordModals.raw.payload')">
                        <n-input v-model:value="draftData.payload" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" :placeholder="t('recordModals.raw.payload_placeholder')" />
                    </n-form-item>
                </template>

                <template v-else-if="draftType === 'vcard'">
                    <n-flex :wrap="true" style="gap: 12px">
                        <div style="flex: 1; min-width: 200px"><n-form-item :label="t('recordModals.vcard.first_name')"><n-input v-model:value="draftData.first_name" :placeholder="t('recordModals.vcard.first_name_placeholder')" /></n-form-item></div>
                        <div style="flex: 1; min-width: 200px"><n-form-item :label="t('recordModals.vcard.last_name')"><n-input v-model:value="draftData.last_name" :placeholder="t('recordModals.vcard.last_name_placeholder')" /></n-form-item></div>
                    </n-flex>
                    <n-form-item :label="t('recordModals.vcard.organization')"><n-input v-model:value="draftData.organization" :placeholder="t('recordModals.vcard.organization_placeholder')" /></n-form-item>
                    <n-form-item :label="t('recordModals.vcard.title')"><n-input v-model:value="draftData.title" :placeholder="t('recordModals.vcard.title_placeholder')" /></n-form-item>
                    <n-form-item :label="t('recordModals.vcard.email')"><n-input v-model:value="draftData.email" :placeholder="t('recordModals.vcard.email_placeholder')" /></n-form-item>
                    <n-flex :wrap="true" style="gap: 12px">
                        <div style="flex: 1; min-width: 200px"><n-form-item :label="t('recordModals.vcard.phone_work')"><n-input v-model:value="draftData.phone_work" :placeholder="t('recordModals.vcard.phone_placeholder')" /></n-form-item></div>
                        <div style="flex: 1; min-width: 200px"><n-form-item :label="t('recordModals.vcard.phone_cell')"><n-input v-model:value="draftData.phone_cell" :placeholder="t('recordModals.vcard.phone_placeholder')" /></n-form-item></div>
                    </n-flex>
                    <n-form-item :label="t('recordModals.vcard.site')"><n-input v-model:value="draftData.site" :placeholder="t('recordModals.vcard.site_placeholder')" /></n-form-item>
                    <n-form-item :label="t('recordModals.vcard.address_country')"><n-input v-model:value="draftData.address_country" :placeholder="t('recordModals.vcard.address_country_placeholder')" /></n-form-item>
                    <n-flex :wrap="true" style="gap: 12px">
                        <div style="flex: 1; min-width: 200px"><n-form-item :label="t('recordModals.vcard.address_region')"><n-input v-model:value="draftData.address_region" :placeholder="t('recordModals.vcard.address_region_placeholder')" /></n-form-item></div>
                        <div style="flex: 1; min-width: 200px"><n-form-item :label="t('recordModals.vcard.address_city')"><n-input v-model:value="draftData.address_city" :placeholder="t('recordModals.vcard.address_city_placeholder')" /></n-form-item></div>
                    </n-flex>
                    <n-form-item :label="t('recordModals.vcard.address_street')"><n-input v-model:value="draftData.address_street" :placeholder="t('recordModals.vcard.address_street_placeholder')" /></n-form-item>
                    <n-form-item :label="t('recordModals.vcard.address_postal_code')"><n-input v-model:value="draftData.address_postal_code" :placeholder="t('recordModals.vcard.address_postal_code_placeholder')" /></n-form-item>
                </template>

                <n-flex justify="end" :wrap="false" style="gap: 8px">
                    <n-button type="primary" @click="saveDraft">{{ t('common.save') }}</n-button>
                </n-flex>
            </n-form>
        </n-modal>
    </div>
</template>
