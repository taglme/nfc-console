<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
    NButton,
    NCard,
    NCheckbox,
    NDivider,
    NFlex,
    NForm,
    NFormItem,
    NInput,
    NModal,
    NSelect,
    NText,
    useMessage,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';

import { submitJob } from '../services/jobSubmit';
import { useAdaptersStore } from '../stores/adapters';
import { useLicenseStore } from '../stores/license';
import { useRunsStore } from '../stores/runs';
import { type JobDraft } from '../services/capabilities';
import { cleanHex, hexToBase64 } from '../utils/encoding';

import { CommandStatus } from 'nfc-jsclient/dist/models/commands';
import type { NdefRecordResource } from 'nfc-jsclient/dist/models/ndefconv';

type RecordType = 'raw' | 'url' | 'text' | 'uri' | 'vcard' | 'mime' | 'phone' | 'geo' | 'aar' | 'poster';

type RecordDraft = {
    type: RecordType;
    data: any;
};

const message = useMessage();
const { t } = useI18n();
const adapters = useAdaptersStore();
const license = useLicenseStore();
const runs = useRunsStore();

const records = ref<RecordDraft[]>([]);
const permanentLock = ref(false);
const sending = ref(false);
const lastJobId = ref('');

const modalOpen = ref(false);
const editIndex = ref<number | null>(null);
const draftType = ref<RecordType>('text');
const draftDataText = ref<string>('{}');

const lastRun = computed(() => {
    if (!adapters.selectedAdapterId) return null;
    return runs.lastRunByAdapterId[adapters.selectedAdapterId] ?? null;
});

const resultsText = ref('');

const canWrite = computed(() => !!adapters.selectedAdapterId && !sending.value);

const typeOptions = [
    { label: 'Raw', value: 'raw' },
    { label: 'URL', value: 'url' },
    { label: 'Text', value: 'text' },
    { label: 'URI', value: 'uri' },
    { label: 'VCard', value: 'vcard' },
    { label: 'MIME', value: 'mime' },
    { label: 'Phone', value: 'phone' },
    { label: 'Geo', value: 'geo' },
    { label: 'AAR', value: 'aar' },
    { label: 'Poster', value: 'poster' },
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

function openAdd() {
    editIndex.value = null;
    draftType.value = 'text';
    draftDataText.value = JSON.stringify(defaultDataFor('text'), null, 2);
    modalOpen.value = true;
}

function openEdit(index: number) {
    const r = records.value[index];
    editIndex.value = index;
    draftType.value = r.type;
    draftDataText.value = JSON.stringify(JSON.parse(JSON.stringify(r.data)), null, 2);
    modalOpen.value = true;
}

function remove(index: number) {
    records.value.splice(index, 1);
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
        parsed = JSON.parse(draftDataText.value);
    } catch (e) {
        message.error(t('write.invalidJson'));
        return;
    }

    const r: RecordDraft = { type: draftType.value, data: parsed };
    if (editIndex.value === null) {
        records.value.push(r);
    } else {
        records.value[editIndex.value] = r;
    }
    modalOpen.value = false;
}

watch(
    () => draftType.value,
    t => {
        draftDataText.value = JSON.stringify(defaultDataFor(t), null, 2);
    },
);

function recordSummary(r: RecordDraft): string {
    switch (r.type) {
        case 'url':
            return r.data?.url ? `url: ${r.data.url}` : 'url';
        case 'uri':
            return r.data?.uri ? `uri: ${r.data.uri}` : 'uri';
        case 'text':
            return r.data?.text ? `text: ${String(r.data.text).slice(0, 40)}` : 'text';
        case 'mime':
            return `mime: ${r.data?.type ?? ''}`;
        case 'aar':
            return r.data?.package_name ? `aar: ${r.data.package_name}` : 'aar';
        case 'phone':
            return r.data?.phone_number ? `phone: ${r.data.phone_number}` : 'phone';
        case 'geo':
            return r.data?.latitude && r.data?.longitude ? `geo: ${r.data.latitude},${r.data.longitude}` : 'geo';
        case 'vcard':
            return `vcard: ${r.data?.first_name ?? ''} ${r.data?.last_name ?? ''}`.trim();
        case 'poster':
            return r.data?.title ? `poster: ${r.data.title}` : 'poster';
        case 'raw':
        default:
            return r.type;
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

function saveToFile() {
    download('records.nfc', JSON.stringify(records.value, null, 2), 'application/json;charset=utf-8');
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
            jobName: 'write',
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
    } catch (e) {
        message.error(e instanceof Error ? e.message : String(e));
    } finally {
        sending.value = false;
    }
}
</script>

<template>
    <n-card :title="t('write.title')">
        <n-flex vertical style="gap: 12px">
            <n-flex align="center" justify="space-between" :wrap="true">
                <n-flex align="center" :wrap="true" style="gap: 8px">
                    <n-button type="primary" :disabled="!canWrite" :loading="sending" @click="onWrite">{{ t('write.write') }}</n-button>
                    <n-checkbox v-model:checked="permanentLock">{{ t('write.permanentLock') }}</n-checkbox>
                </n-flex>

                <n-flex align="center" :wrap="true" style="gap: 8px">
                    <n-button @click="openAdd">{{ t('write.addRecord') }}</n-button>
                    <n-button :disabled="records.length === 0" @click="saveToFile">{{ t('common.save') }}</n-button>
                    <label>
                        <input type="file" accept=".nfc,application/json" style="display:none" @change="loadFromFile" />
                        <n-button>{{ t('common.load') }}</n-button>
                    </label>
                </n-flex>
            </n-flex>

            <n-divider />

            <div v-if="records.length === 0">
                <n-text depth="3">{{ t('write.noRecords') }}</n-text>
            </div>

            <div v-else>
                <n-flex vertical style="gap: 8px">
                    <n-card v-for="(r, idx) in records" :key="idx" size="small">
                        <n-flex align="center" justify="space-between" :wrap="false">
                            <n-flex align="center" :wrap="false" style="gap: 8px">
                                <n-text strong>{{ idx + 1 }}.</n-text>
                                <n-text>{{ r.type }}</n-text>
                                <n-text depth="3">{{ recordSummary(r) }}</n-text>
                            </n-flex>

                            <n-flex :wrap="false" style="gap: 6px">
                                <n-button size="small" @click="move(idx, -1)">Up</n-button>
                                <n-button size="small" @click="move(idx, 1)">Down</n-button>
                                <n-button size="small" @click="openEdit(idx)">Edit</n-button>
                                <n-button size="small" type="error" @click="remove(idx)">Remove</n-button>
                            </n-flex>
                        </n-flex>
                    </n-card>
                </n-flex>
            </div>

            <n-divider />

            <div>
                <n-text depth="3">{{ t('write.lastRun') }}</n-text>
                <n-input type="textarea" readonly :value="resultsText" :autosize="{ minRows: 6, maxRows: 12 }" />
            </div>
        </n-flex>

        <n-modal v-model:show="modalOpen" preset="card" :title="t('write.modalTitle')" style="width: 720px">
            <n-form label-placement="top">
                <n-form-item :label="t('write.type')">
                    <n-select v-model:value="draftType" :options="typeOptions" />
                </n-form-item>

                <n-form-item :label="t('write.dataJson')">
                    <n-input
                        v-model:value="draftDataText"
                        type="textarea"
                        :autosize="{ minRows: 10, maxRows: 16 }"
                        placeholder="Record data JSON"
                    />
                </n-form-item>

                <n-flex justify="end" :wrap="false" style="gap: 8px">
                    <n-button @click="modalOpen = false">{{ t('write.cancel') }}</n-button>
                    <n-button type="primary" @click="saveDraft">Save</n-button>
                </n-flex>
            </n-form>
        </n-modal>
    </n-card>
</template>
