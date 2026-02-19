<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
    NButton,
    NCard,
    NFlex,
    NInput,
    NSelect,
    NText,
    useMessage,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';

import { submitJob } from '../services/jobSubmit';
import { useAdaptersStore } from '../stores/adapters';
import { useLicenseStore } from '../stores/license';
import { useRunsStore } from '../stores/runs';
import { useWsStore } from '../stores/ws';
import { type JobDraft } from '../services/capabilities';
import { base64ToAscii, base64ToHex, hexToBase64 } from '../utils/encoding';

import { CommandStatus } from 'nfc-jsclient/dist/models/commands';
import type { JobStepResource } from 'nfc-jsclient/dist/models/jobs';
import type { JobRun } from 'nfc-jsclient/dist/client/runs';

const message = useMessage();
const { t } = useI18n();
const adapters = useAdaptersStore();
const license = useLicenseStore();
const ws = useWsStore();
const runs = useRunsStore();

const commandsText = ref('');
const results = ref<string[]>([]);
const outputFormat = ref<'hex' | 'ascii'>('hex');
const targetEntity = ref<'tag' | 'adapter'>('tag');
const sending = ref(false);
const lastJobId = ref<string>('');

const canSend = computed(() => !sending.value && !!adapters.selectedAdapterId);

const output = computed(() => results.value.join('\r\n'));

function formatRx(base64: string): string {
    return outputFormat.value === 'ascii' ? base64ToAscii(base64) : base64ToHex(base64);
}

function buildStepsFromText(text: string): JobStepResource[] {
    const lines = text.split(/\r?\n/);
    const steps: JobStepResource[] = [];

    const cmd = targetEntity.value === 'tag' ? 'transmit_tag' : 'transmit_adapter';

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('#')) continue;

        const txBase64 = hexToBase64(trimmed);
        steps.push({
            command: cmd as any,
            params: {
                tx_bytes: txBase64,
            } as any,
        } as any);
    }
    return steps;
}

async function send() {
    if (!adapters.selectedAdapterId) {
        message.error(t('app.selectAdapterFirst'));
        return;
    }
    if (!ws.connected) {
        message.warning(t('app.wsDisconnectedWarn'));
    }

    let steps: JobStepResource[];
    try {
        steps = buildStepsFromText(commandsText.value);
    } catch (e) {
        message.error(e instanceof Error ? e.message : String(e));
        return;
    }

    if (steps.length === 0) {
        message.error('Enter at least one HEX command.');
        return;
    }

    const draft: JobDraft = {
        repeat: 1,
        steps: steps.map(s => ({ command: (s as any).command, params: (s as any).params })),
    };

    sending.value = true;
    results.value = [];
    lastJobId.value = '';

    try {
        const res = await submitJob({
            adapterId: adapters.selectedAdapterId,
            jobName: `console_${targetEntity.value}`,
            draft,
            access: license.access,
            onWarning: w => message.warning(w),
        });
        if (!res.ok) {
            message.error(res.error);
            return;
        }
        lastJobId.value = res.jobId;
        message.success('Job submitted.');
    } catch (e) {
        message.error(e instanceof Error ? e.message : String(e));
    } finally {
        sending.value = false;
    }
}

function clearResults() {
    results.value = [];
}

function onRunEvent(run: JobRun) {
    const outputLines: string[] = [];

    for (const r of run.results) {
        const statusStr = r.status === CommandStatus.Success ? 'success' : r.status === CommandStatus.Error ? `error: ${r.message}` : 'unknown';
        const tx = (r.params as any)?.tx_bytes ? base64ToHex((r.params as any).tx_bytes) : '';
        const rx = (r.output as any)?.rx_bytes ? formatRx((r.output as any).rx_bytes) : '';

        if (tx) outputLines.push(`> ${tx}`);
        outputLines.push(statusStr);
        if (rx) outputLines.push(`< ${rx}`);
        outputLines.push('');
    }

    results.value = outputLines;
}

watch(
    () => {
        if (!adapters.selectedAdapterId) return null;
        return runs.lastRunByAdapterId[adapters.selectedAdapterId] ?? null;
    },
    run => {
        if (!run) return;
        if (lastJobId.value && run.jobID !== lastJobId.value) return;
        onRunEvent(run);
    },
    { deep: false },
);
</script>

<template>
    <n-card :title="t('console.title')">
        <n-flex vertical style="gap: 12px">
            <n-flex align="center" justify="space-between" :wrap="true">
                <n-flex align="center" :wrap="true" style="gap: 8px">
                    <n-text depth="3">{{ t('console.target') }}:</n-text>
                    <n-select
                        v-model:value="targetEntity"
                        :options="[
                            { label: 'Tag', value: 'tag' },
                            { label: 'Adapter', value: 'adapter' },
                        ]"
                        style="width: 160px"
                    />

                    <n-text depth="3">{{ t('console.output') }}:</n-text>
                    <n-select
                        v-model:value="outputFormat"
                        :options="[
                            { label: 'HEX', value: 'hex' },
                            { label: 'ASCII', value: 'ascii' },
                        ]"
                        style="width: 160px"
                    />
                </n-flex>

                <n-flex :wrap="false" style="gap: 8px">
                    <n-button type="primary" :disabled="!canSend" :loading="sending" @click="send">{{ t('console.send') }}</n-button>
                    <n-button :disabled="results.length === 0" @click="clearResults">{{ t('common.clear') }}</n-button>
                </n-flex>
            </n-flex>

            <n-flex :wrap="true" style="gap: 12px">
                <div style="flex: 1; min-width: 320px">
                    <n-text depth="3">{{ t('console.commands') }}</n-text>
                    <n-input
                        v-model:value="commandsText"
                        type="textarea"
                        placeholder="30 01"
                        :autosize="{ minRows: 10, maxRows: 20 }"
                    />
                </div>

                <div style="flex: 1; min-width: 320px">
                    <n-text depth="3">{{ t('console.results') }}</n-text>
                    <n-input
                        :value="output"
                        type="textarea"
                        readonly
                        :autosize="{ minRows: 10, maxRows: 20 }"
                        :placeholder="t('console.resultsPlaceholder')"
                    />
                </div>
            </n-flex>
        </n-flex>
    </n-card>
</template>
