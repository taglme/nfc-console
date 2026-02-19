<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
    NButton,
    NCard,
    NDataTable,
    NFlex,
    NList,
    NListItem,
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
import { base64ToHex } from '../utils/encoding';

import { Command } from 'nfc-jsclient/dist/models/commands';
import type { TagResource } from 'nfc-jsclient/dist/models/tags';
import type { NdefRecordResource, NdefResource } from 'nfc-jsclient/dist/models/ndefconv';

const message = useMessage();
const { t } = useI18n();
const adapters = useAdaptersStore();
const license = useLicenseStore();
const runs = useRunsStore();

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

const canRead = computed(() => !!adapters.selectedAdapterId && !sending.value);

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
            jobName: 'read',
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

function openRecord(r: NdefRecordResource) {
    selectedRecord.value = r;
    recordModalOpen.value = true;
}

const tagColumns = computed(() => [
    {
        title: t('read.tagId'),
        key: 'tag_id',
    },
    {
        title: t('read.uid'),
        key: 'uid',
        render: (row: any) => (row.uid ? base64ToHex(row.uid) : ''),
    },
    {
        title: t('read.tech'),
        key: 'tech',
        render: (row: any) => row.tech ?? '',
    },
]);

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
</script>

<template>
    <n-card :title="t('read.title')">
        <n-flex vertical style="gap: 12px">
            <n-flex align="center" justify="space-between" :wrap="true">
                <n-flex align="center" :wrap="true" style="gap: 8px">
                    <n-button type="primary" :disabled="!canRead" :loading="sending" @click="onRead">{{ t('read.read') }}</n-button>
                    <n-text depth="3" v-if="license.hostTier">{{ t('common.tier') }}: {{ license.hostTier }}</n-text>
                </n-flex>

                <n-flex align="center" :wrap="false" style="gap: 8px">
                    <n-text depth="3">{{ t('read.recordsView') }}:</n-text>
                    <n-select v-model:value="outputMode" :options="recordOptions" style="width: 140px" />
                </n-flex>
            </n-flex>

            <div>
                <n-text depth="3">{{ t('read.tags') }}</n-text>
                <n-data-table :columns="tagColumns" :data="tags" :bordered="false" />
            </div>

            <div>
                <n-text depth="3">{{ t('read.ndef') }}</n-text>
                <div v-if="!ndef">
                    <n-text depth="3">{{ t('read.noNdef') }}</n-text>
                </div>
                <div v-else>
                    <n-text depth="3">{{ t('read.readonly') }}: {{ ndef.read_only ? t('common.yes') : t('common.no') }}</n-text>
                    <n-list bordered>
                        <n-list-item v-for="(r, idx) in recordList" :key="idx" @click="openRecord(r)">
                            {{ idx + 1 }}. {{ recordLabel(r) }}
                        </n-list-item>
                    </n-list>
                </div>
            </div>
        </n-flex>

        <n-modal v-model:show="recordModalOpen" preset="card" :title="t('read.record')" style="width: 640px">
            <pre style="white-space: pre-wrap; margin: 0">{{ selectedRecord ? JSON.stringify(selectedRecord, null, 2) : '' }}</pre>
        </n-modal>
    </n-card>
</template>
