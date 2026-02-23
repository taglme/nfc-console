<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NCard, NFlex, NInput, NSelect, NText, NIcon, useMessage } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { CopyOutline } from '@vicons/ionicons5';

import { submitJob } from '../services/jobSubmit';
import { useAdaptersStore } from '../stores/adapters';
import { useLicenseStore } from '../stores/license';
import { useRunsStore } from '../stores/runs';
import { useJobModalStore } from '../stores/jobModal';
import { useWsStore } from '../stores/ws';
import { type JobDraft } from '../services/capabilities';

import { Command } from 'nfc-jsclient/dist/models/commands';

type OutputMode = 'all' | 'memory' | 'memory_pages';

type DumpRow = {
    page?: string;
    data?: string;
    info?: string;
};

const message = useMessage();
const { t } = useI18n();
const adapters = useAdaptersStore();
const license = useLicenseStore();
const runs = useRunsStore();
const jobModal = useJobModalStore();
const ws = useWsStore();

const sending = ref(false);
const lastJobId = ref('');
const outputMode = ref<OutputMode>('all');

const dump = ref<DumpRow[] | null>(null);

const lastRun = computed(() => {
    if (!adapters.selectedAdapterId) return null;
    return runs.lastRunByAdapterId[adapters.selectedAdapterId] ?? null;
});

const canDump = computed(() => !!adapters.selectedAdapterId && !sending.value && ws.connected);

const outputOptions = computed(() => [
    { label: t('dump.all'), value: 'all' },
    { label: t('dump.memory'), value: 'memory' },
    { label: t('dump.memoryPages'), value: 'memory_pages' },
]);

watch(
    () => lastRun.value,
    run => {
        if (!run) return;
        if (lastJobId.value && run.jobID !== lastJobId.value) return;

        const dumpStep = run.results.find(r => r.command === Command.GetDump);
        const rows = (dumpStep?.output as any)?.memory_dump as DumpRow[] | undefined;
        dump.value = Array.isArray(rows) ? rows : null;
    },
    { deep: false },
);

const outputText = computed(() => {
    if (!dump.value || dump.value.length === 0) return '';

    const lines: string[] = [];
    for (const row of dump.value) {
        switch (outputMode.value) {
            case 'memory': {
                if (row.data) lines.push(String(row.data));
                break;
            }
            case 'memory_pages': {
                const parts = [] as string[];
                if (row.page) parts.push(String(row.page));
                if (row.data) parts.push(String(row.data));
                if (parts.length > 0) lines.push(parts.join(' '));
                break;
            }
            case 'all':
            default: {
                const parts = [] as string[];
                if (row.page) parts.push(String(row.page));
                if (row.data) parts.push(String(row.data));
                if (row.info) parts.push(`| ${String(row.info)}`);
                if (parts.length > 0) lines.push(parts.join(' '));
                break;
            }
        }
    }
    return lines.join('\r\n');
});

function download(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function saveResults() {
    if (!outputText.value) return;
    download('results.txt', outputText.value, 'text/plain;charset=utf-8');
}

function clear() {
    dump.value = null;
}

async function onDump() {
    if (!adapters.selectedAdapterId) {
        message.error(t('app.selectAdapterFirst'));
        return;
    }

    const draft: JobDraft = {
        repeat: 1,
        steps: [{ command: 'get_dump', params: {} }],
    };

    sending.value = true;
    lastJobId.value = '';
    dump.value = null;
    try {
        const res = await submitJob({
            adapterId: adapters.selectedAdapterId,
            jobName: t('dump.pageTitle'),
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
        jobModal.openForJob({ adapterId: adapters.selectedAdapterId, jobId: res.jobId, jobName: t('dump.pageTitle') });
    } catch (e) {
        message.error(e instanceof Error ? e.message : String(e));
    } finally {
        sending.value = false;
    }
}
</script>

<template>
    <n-flex vertical size="large">
        <n-card :bordered="false" content-style="padding: 24px;">
            <n-flex align="center" :wrap="false" style="gap: 24px; margin-bottom: 24px;">
                <n-icon size="40">
                    <CopyOutline />
                </n-icon>
                <div style="flex: 1">
                    <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">{{ t('dump.pageTitle') }}</div>
                    <n-text depth="3">{{ t('dump.pageDesc') }}</n-text>
                </div>
                <!-- Action -->
                <n-button
                    type="primary"
                    :disabled="!canDump"
                    :loading="sending"
                    @click="onDump"
                    style="min-width: 120px"
                >
                    {{ t('dump.scan') }}
                </n-button>
            </n-flex>

            <div style="margin-bottom: 8px;">
                <n-text depth="2" style="font-size: 16px; font-weight: 400">{{ t('dump.memorySubtitle') }}</n-text>
            </div>
            
            <n-flex align="center" :wrap="true" style="gap: 8px; margin-bottom: 12px;">
                <n-button secondary :disabled="!outputText" @click="saveResults">{{ t('common.save') }}</n-button>
                <n-button secondary :disabled="!dump" @click="clear">{{ t('common.clear') }}</n-button>
            </n-flex>

            <n-input
                type="textarea"
                readonly
                :value="outputText"
                :autosize="{ minRows: 12, maxRows: 24 }"
                :placeholder="t('dump.placeholder')"
                style="margin-bottom: 12px;"
            />

            <n-flex justify="end" align="center" :wrap="false" style="gap: 8px;">
                <n-text depth="3">{{ t('dump.output') }}:</n-text>
                <n-select v-model:value="outputMode" :options="outputOptions" style="width: 180px" />
            </n-flex>
        </n-card>
    </n-flex>
</template>
