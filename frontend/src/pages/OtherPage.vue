<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NCard, NFlex, NInput, NText, useMessage, NIcon } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { LockClosedOutline, TrashOutline } from '@vicons/ionicons5';

import { submitJob } from '../services/jobSubmit';
import { useAdaptersStore } from '../stores/adapters';
import { useLicenseStore } from '../stores/license';
import { useRunsStore } from '../stores/runs';
import { useJobModalStore } from '../stores/jobModal';
import { useWsStore } from '../stores/ws';
import { type JobDraft } from '../services/capabilities';

import { CommandStatus } from 'nfc-jsclient/dist/models/commands';

const message = useMessage();
const { t } = useI18n();
const adapters = useAdaptersStore();
const license = useLicenseStore();
const runs = useRunsStore();
const jobModal = useJobModalStore();
const ws = useWsStore();

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
        jobModal.openForJob({ adapterId: adapters.selectedAdapterId, jobId: res.jobId, jobName });
    } catch (e) {
        message.error(e instanceof Error ? e.message : String(e));
    } finally {
        if (kind === 'lock') sendingLock.value = false;
        if (kind === 'format') sendingFormat.value = false;
    }
}

async function onLock() {
    await submitActionJob(t('other.lockTitle'), [{ command: 'lock_permanent', params: {} }], 'lock');
}

async function onFormat() {
    await submitActionJob(t('other.formatTitle'), [{ command: 'format_default', params: {} }], 'format');
}
</script>

<template>
    <div style="padding: 24px; display: flex; flex-direction: column; gap: 24px;">
        <div style="flex: 1; min-width: 0; margin-bottom: 24px;">
            <h2 style="font-size: 16px; line-height: 24px; font-weight: 600; color: var(--n-text-color); margin: 0;">{{ t('other.pageTitle') }}</h2>
            <p style="font-size: 13px; line-height: 20px; color: var(--n-text-color-3); margin: 0; margin-top: 4px;">{{ t('other.pageDesc') }}</p>
        </div>

        <div>
            <n-flex align="center" justify="space-between" :wrap="false" style="gap: 48px">
                <div style="flex: 1; min-width: 0;">
                    <div style="margin-bottom: 4px;">
                        <h3 style="font-size: 14px; font-weight: 600; color: var(--n-text-color); margin: 0; text-transform: uppercase; letter-spacing: 0.025em;">
                            {{ t('other.lockTitle') }}
                        </h3>
                    </div>
                    <div style="font-size: 14px; color: var(--n-text-color-3);">{{ t('other.lockDesc') }}</div>
                </div>
                <!-- Action -->
                <n-button
                    type="primary"
                    :loading="sendingLock"
                    :disabled="!adapters.selectedAdapterId || !ws.connected"
                    @click="onLock"
                    style="min-width: 120px"
                >
                    {{ t('other.lock') }}
                </n-button>
            </n-flex>
        </div>

        <div>
            <n-flex align="center" justify="space-between" :wrap="false" style="gap: 48px">
                <div style="flex: 1; min-width: 0;">
                    <div style="margin-bottom: 4px;">
                        <h3 style="font-size: 14px; font-weight: 600; color: var(--n-text-color); margin: 0; text-transform: uppercase; letter-spacing: 0.025em;">
                            {{ t('other.formatTitle') }}
                        </h3>
                    </div>
                    <div style="font-size: 14px; color: var(--n-text-color-3);">{{ t('other.formatDesc') }}</div>
                </div>
                <!-- Action -->
                 <n-button
                    type="primary"
                    :loading="sendingFormat"
                    :disabled="!adapters.selectedAdapterId || !ws.connected"
                    @click="onFormat"
                    style="min-width: 120px"
                >
                    {{ t('other.format') }}
                </n-button>
            </n-flex>
        </div>

    </div>
</template>
