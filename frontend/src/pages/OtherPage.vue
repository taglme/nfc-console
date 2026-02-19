<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { NButton, NCard, NFlex, NInput, NText, useMessage } from 'naive-ui';
import { useI18n } from 'vue-i18n';

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
    <n-card :title="t('other.title')">
        <n-flex vertical style="gap: 12px">
            <n-card size="small" :title="t('other.lockTitle')">
                <n-flex align="center" justify="space-between" :wrap="true">
                    <n-text depth="3">{{ t('other.lockDesc') }}</n-text>
                    <n-button type="primary" :loading="sendingLock" :disabled="!adapters.selectedAdapterId" @click="onLock">
                        {{ t('other.lock') }}
                    </n-button>
                </n-flex>
            </n-card>

            <n-card size="small" :title="t('other.formatTitle')">
                <n-flex align="center" justify="space-between" :wrap="true">
                    <n-text depth="3">{{ t('other.formatDesc') }}</n-text>
                    <n-button type="primary" :loading="sendingFormat" :disabled="!adapters.selectedAdapterId" @click="onFormat">
                        {{ t('other.format') }}
                    </n-button>
                </n-flex>
            </n-card>

            <div>
                <n-text depth="3">{{ t('other.lastRun') }}</n-text>
                <n-input type="textarea" readonly :value="resultsText" :autosize="{ minRows: 6, maxRows: 12 }" />
            </div>
        </n-flex>
    </n-card>
</template>
