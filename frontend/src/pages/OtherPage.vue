<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NCard, NFlex, NInput, NText, useMessage, NIcon } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { LockClosedOutline, TrashOutline } from '@vicons/ionicons5';

import { submitJob } from '../services/jobSubmit';
import { useAdaptersStore } from '../stores/adapters';
import { useLicenseStore } from '../stores/license';
import { useRunsStore } from '../stores/runs';
import { type JobDraft } from '../services/capabilities';

import { CommandStatus } from 'nfc-jsclient/dist/models/commands';

const message = useMessage();
const { t } = useI18n();
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

async function submitActionJob(jobName: string, steps: Array<{ command: string; params: any }>, kind: 'lock' | 'format') {
    if (!adapters.selectedAdapterId) {
        message.error(t('app.selectAdapterFirst'));
        return;
    }

    const draft: JobDraft = { repeat: 0, steps };

    if (kind === 'lock') sendingLock.value = true;
    if (kind === 'format') sendingFormat.value = true;
    lastJobId.value = '';
    resultsText.value = '';

    try {
        const res = await submitJob({
            adapterId: adapters.selectedAdapterId,
            jobName,
            draft,
            access: license.access,
            onWarning: (w: string) => message.warning(w),
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
        if (kind === 'lock') sendingLock.value = false;
        if (kind === 'format') sendingFormat.value = false;
    }
}

async function onLock() {
    await submitActionJob('lock', [{ command: 'lock_permanent', params: {} }], 'lock');
}

async function onFormat() {
    await submitActionJob('format', [{ command: 'format_default', params: {} }], 'format');
}
</script>

<template>
    <n-flex vertical size="large">
        <n-card :bordered="false" content-style="padding: 24px;">
            <n-flex align="center" :wrap="false" style="gap: 24px">
                <n-icon size="40">
                    <LockClosedOutline />
                </n-icon>
                <div style="flex: 1">
                    <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">{{ t('other.lockTitle') }}</div>
                    <n-text depth="3">{{ t('other.lockDesc') }}</n-text>
                </div>
                <!-- Action -->
                <n-button
                    type="primary"
                    :loading="sendingLock"
                    :disabled="!adapters.selectedAdapterId"
                    @click="onLock"
                    style="min-width: 120px"
                >
                    {{ t('other.lock') }}
                </n-button>
            </n-flex>
        </n-card>

        <n-card :bordered="false" content-style="padding: 24px;">
            <n-flex align="center" :wrap="false" style="gap: 24px">
                <n-icon size="40">
                    <TrashOutline />
                </n-icon>
                <div style="flex: 1">
                    <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">{{ t('other.formatTitle') }}</div>
                    <n-text depth="3">{{ t('other.formatDesc') }}</n-text>
                </div>
                <!-- Action -->
                 <n-button
                    type="primary"
                    :loading="sendingFormat"
                    :disabled="!adapters.selectedAdapterId"
                    @click="onFormat"
                    style="min-width: 120px"
                >
                    {{ t('other.format') }}
                </n-button>
            </n-flex>
        </n-card>

    </n-flex>
</template>
