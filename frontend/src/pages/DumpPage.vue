<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NCard, NFlex, NInput, NSelect, NText, useMessage } from 'naive-ui';

import { getSdk } from '../services/sdk';
import { useAdaptersStore } from '../stores/adapters';
import { useLicenseStore } from '../stores/license';
import { useRunsStore } from '../stores/runs';
import { enforceJobDraft, type JobDraft } from '../services/capabilities';

import type { NewJob } from 'nfc-jsclient/dist/models/jobs';
import { Command } from 'nfc-jsclient/dist/models/commands';

type OutputMode = 'all' | 'memory' | 'memory_pages';

type DumpRow = {
    page?: string;
    data?: string;
    info?: string;
};

const message = useMessage();
const adapters = useAdaptersStore();
const license = useLicenseStore();
const runs = useRunsStore();

const sending = ref(false);
const lastJobId = ref('');
const outputMode = ref<OutputMode>('all');

const dump = ref<DumpRow[] | null>(null);

const lastRun = computed(() => {
    if (!adapters.selectedAdapterId) return null;
    return runs.lastRunByAdapterId[adapters.selectedAdapterId] ?? null;
});

const canDump = computed(() => !!adapters.selectedAdapterId && !sending.value);

const outputOptions = [
    { label: 'All', value: 'all' },
    { label: 'Memory', value: 'memory' },
    { label: 'Memory pages', value: 'memory_pages' },
];

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
        message.error('Select an adapter first.');
        return;
    }

    const draft: JobDraft = {
        repeat: 1,
        steps: [{ command: 'get_dump', params: {} }],
    };

    const enforced = enforceJobDraft(license.access, draft);
    if (!enforced.ok) {
        message.error(enforced.error);
        return;
    }
    enforced.warnings.forEach(w => message.warning(w));

    const job: NewJob = {
        job_name: 'dump',
        repeat: enforced.job.repeat,
        expire_after: 60,
        steps: enforced.job.steps as any,
    };

    sending.value = true;
    lastJobId.value = '';
    dump.value = null;
    try {
        const sdk = getSdk();
        await sdk.Jobs.deleteAll(adapters.selectedAdapterId);
        const created = await sdk.Jobs.add(adapters.selectedAdapterId, job);
        lastJobId.value = created.jobID;
        message.success('Dump job submitted.');
    } catch (e) {
        message.error(e instanceof Error ? e.message : String(e));
    } finally {
        sending.value = false;
    }
}
</script>

<template>
    <n-card title="Dump">
        <n-flex vertical style="gap: 12px">
            <n-flex align="center" justify="space-between" :wrap="true">
                <n-flex align="center" :wrap="true" style="gap: 8px">
                    <n-button type="primary" :disabled="!canDump" :loading="sending" @click="onDump">Scan</n-button>
                    <n-button :disabled="!outputText" @click="saveResults">Save</n-button>
                    <n-button :disabled="!dump" @click="clear">Clear</n-button>
                </n-flex>

                <n-flex align="center" :wrap="false" style="gap: 8px">
                    <n-text depth="3">Output:</n-text>
                    <n-select v-model:value="outputMode" :options="outputOptions" style="width: 180px" />
                </n-flex>
            </n-flex>

            <n-input
                type="textarea"
                readonly
                :value="outputText"
                :autosize="{ minRows: 12, maxRows: 24 }"
                placeholder="Dump output will appear here"
            />
        </n-flex>
    </n-card>
</template>
