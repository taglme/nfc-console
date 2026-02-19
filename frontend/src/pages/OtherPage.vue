<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NCard, NFlex, NInput, NText, useMessage } from 'naive-ui';

import { getSdk } from '../services/sdk';
import { useAdaptersStore } from '../stores/adapters';
import { useLicenseStore } from '../stores/license';
import { useRunsStore } from '../stores/runs';
import { enforceJobDraft, type JobDraft } from '../services/capabilities';

import type { NewJob } from 'nfc-jsclient/dist/models/jobs';
import { CommandStatus } from 'nfc-jsclient/dist/models/commands';

const message = useMessage();
const adapters = useAdaptersStore();
const license = useLicenseStore();
const runs = useRunsStore();

const sendingLock = ref(false);
const sendingFormat = ref(false);
const lastJobId = ref('');

const lastRun = computed(() => {
    if (!adapters.selectedAdapterId) return null;
    return runs.lastRunByAdapterId[adapters.selectedAdapterId] ?? null;
});

const resultsText = ref('');

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

async function submitJob(jobName: string, steps: Array<{ command: string; params: any }>, kind: 'lock' | 'format') {
    if (!adapters.selectedAdapterId) {
        message.error('Select an adapter first.');
        return;
    }

    const draft: JobDraft = {
        repeat: 0,
        steps,
    };
    const enforced = enforceJobDraft(license.access, draft);
    if (!enforced.ok) {
        message.error(enforced.error);
        return;
    }
    enforced.warnings.forEach(w => message.warning(w));

    const job: NewJob = {
        job_name: jobName,
        repeat: enforced.job.repeat,
        expire_after: 60,
        steps: enforced.job.steps as any,
    };

    if (kind === 'lock') sendingLock.value = true;
    if (kind === 'format') sendingFormat.value = true;
    lastJobId.value = '';
    resultsText.value = '';

    try {
        const sdk = getSdk();
        await sdk.Jobs.deleteAll(adapters.selectedAdapterId);
        const created = await sdk.Jobs.add(adapters.selectedAdapterId, job);
        lastJobId.value = created.jobID;
        message.success('Job submitted.');
    } catch (e) {
        message.error(e instanceof Error ? e.message : String(e));
    } finally {
        if (kind === 'lock') sendingLock.value = false;
        if (kind === 'format') sendingFormat.value = false;
    }
}

async function onLock() {
    await submitJob('lock', [{ command: 'lock_permanent', params: {} }], 'lock');
}

async function onFormat() {
    await submitJob('format', [{ command: 'format_default', params: {} }], 'format');
}
</script>

<template>
    <n-card title="Other">
        <n-flex vertical style="gap: 12px">
            <n-card size="small" title="Lock tag">
                <n-flex align="center" justify="space-between" :wrap="true">
                    <n-text depth="3">Permanently lock the tag (irreversible).</n-text>
                    <n-button type="primary" :loading="sendingLock" :disabled="!adapters.selectedAdapterId" @click="onLock">
                        Lock
                    </n-button>
                </n-flex>
            </n-card>

            <n-card size="small" title="Format tag">
                <n-flex align="center" justify="space-between" :wrap="true">
                    <n-text depth="3">Format tag to default state.</n-text>
                    <n-button type="primary" :loading="sendingFormat" :disabled="!adapters.selectedAdapterId" @click="onFormat">
                        Format
                    </n-button>
                </n-flex>
            </n-card>

            <div>
                <n-text depth="3">Last run</n-text>
                <n-input type="textarea" readonly :value="resultsText" :autosize="{ minRows: 6, maxRows: 12 }" />
            </div>
        </n-flex>
    </n-card>
</template>
