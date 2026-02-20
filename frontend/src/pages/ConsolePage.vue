<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
    NButton,
    NCard,
    NFlex,
    NInput,
    NList,
    NListItem,
    NModal,
    NSelect,
    NText,
    NIcon,
    useMessage,
} from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { TerminalOutline, ChevronDownOutline } from '@vicons/ionicons5';

import { submitJob } from '../services/jobSubmit';
import { useAdaptersStore } from '../stores/adapters';
import { useLicenseStore } from '../stores/license';
import { useRunsStore } from '../stores/runs';
import { useWsStore } from '../stores/ws';
import { useSnippetsStore } from '../stores/snippets';
import { useJobModalStore } from '../stores/jobModal';
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
const snippets = useSnippetsStore();
const jobModal = useJobModalStore();

const commandsText = ref('');
const results = ref<string[]>([]);
const outputFormat = ref<'hex' | 'ascii'>('hex');
const targetEntity = ref<'tag' | 'adapter'>('tag');
const sending = ref(false);
const lastJobId = ref<string>('');

const fileInputRef = ref<HTMLInputElement | null>(null);

const snippetsOpen = ref(false);
const insertingSnippet = ref(false);

const snippetKind = computed(() => (targetEntity.value === 'tag' ? 'tag' : 'adapter'));
const snippetList = computed(() => (snippetKind.value === 'tag' ? snippets.tag : snippets.adapter));

const canSend = computed(() => !sending.value && !!adapters.selectedAdapterId);

const output = computed(() => results.value.join('\r\n'));

function download(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function onSaveCommands() {
    download('commands.txt', commandsText.value ?? '', 'text/plain;charset=utf-8');
}

function onSaveResults() {
    download('results.txt', output.value ?? '', 'text/plain;charset=utf-8');
}

function onLoadCommandsClick() {
    fileInputRef.value?.click();
}

async function onLoadCommandsSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    try {
        const file = input.files?.[0];
        if (!file) return;
        const text = await file.text();
        commandsText.value = text;
        message.success(t('console.loadedCommands'));
    } catch (e) {
        message.error(e instanceof Error ? e.message : String(e));
    } finally {
        if (input) input.value = '';
    }
}

async function openSnippets() {
    snippetsOpen.value = true;
    await snippets.ensureLoaded(snippetKind.value);
}

async function onInsertSnippet(code: string) {
    if (!code) return;
    insertingSnippet.value = true;
    try {
        const trimmed = code.trim();
        if (trimmed.length === 0) return;

        const current = commandsText.value ?? '';
        const next = current.trim().length === 0 ? trimmed : `${current.replace(/\s*$/, '')}\n${trimmed}`;
        commandsText.value = next;
        snippetsOpen.value = false;
    } finally {
        insertingSnippet.value = false;
    }
}

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
        message.error(t('console.emptyCommands'));
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
            message.error(res.errorKey ? t(res.errorKey, res.errorParams ?? {}) : res.error);
            return;
        }
        lastJobId.value = res.jobId;
        message.success(t('common.jobSubmitted'));
        jobModal.openForJob({
            adapterId: adapters.selectedAdapterId,
            jobId: res.jobId,
            jobName: `console_${targetEntity.value}`,
        });
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
        const statusStr =
            r.status === CommandStatus.Success
                ? t('console.statusSuccess')
                : r.status === CommandStatus.Error
                  ? t('console.statusError', { message: r.message ?? '' })
                  : t('console.statusUnknown');
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
    <n-flex vertical size="large">
        <n-card :bordered="false" content-style="padding: 24px;">
            <n-flex align="center" :wrap="false" style="gap: 24px; margin-bottom: 24px;">
                <n-icon size="40">
                    <TerminalOutline />
                </n-icon>
                <div style="flex: 1">
                    <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">{{ t('console.pageTitle') }}</div>
                    <n-text depth="3">{{ t('console.pageDesc') }}</n-text>
                </div>
                <!-- Action -->
                <n-button
                    type="primary"
                    :disabled="!canSend"
                    :loading="sending"
                    @click="send"
                    style="min-width: 120px"
                >
                    {{ t('console.send') }}
                </n-button>
            </n-flex>

            <n-flex :wrap="true" style="gap: 24px">
                <div style="flex: 1; min-width: 320px">
                    <div style="margin-bottom: 8px;">
                        <n-text depth="2" style="font-size: 16px; font-weight: 400">{{ t('console.commandsSubtitle') }}</n-text>
                    </div>
                    
                    <n-flex :wrap="false" style="gap: 8px; margin-bottom: 12px;">
                        <n-button @click="openSnippets">
                            {{ t('console.addDropdown') }} <n-icon style="margin-left: 4px"><ChevronDownOutline /></n-icon>
                        </n-button>
                        <n-button @click="onLoadCommandsClick">{{ t('common.load') }}</n-button>
                        <n-button @click="onSaveCommands">{{ t('common.save') }}</n-button>
                    </n-flex>

                    <n-input
                        v-model:value="commandsText"
                        type="textarea"
                        placeholder="30 01"
                        :autosize="{ minRows: 10, maxRows: 20 }"
                        style="margin-bottom: 12px;"
                    />

                    <n-flex justify="end" align="center" :wrap="false" style="gap: 8px;">
                        <n-text depth="3">{{ t('console.target') }}:</n-text>
                        <n-select
                            v-model:value="targetEntity"
                            :options="[
                                { label: t('console.targetTag'), value: 'tag' },
                                { label: t('console.targetAdapter'), value: 'adapter' },
                            ]"
                            style="width: 160px"
                        />
                    </n-flex>
                </div>

                <div style="flex: 1; min-width: 320px">
                    <div style="margin-bottom: 8px;">
                        <n-text depth="2" style="font-size: 16px; font-weight: 400">{{ t('console.resultsSubtitle') }}</n-text>
                    </div>

                    <n-flex :wrap="false" style="gap: 8px; margin-bottom: 12px;">
                        <n-button :disabled="results.length === 0" @click="onSaveResults">{{ t('common.save') }}</n-button>
                        <n-button :disabled="results.length === 0" @click="clearResults">{{ t('common.clear') }}</n-button>
                    </n-flex>

                    <n-input
                        :value="output"
                        type="textarea"
                        readonly
                        :autosize="{ minRows: 10, maxRows: 20 }"
                        :placeholder="t('console.resultsPlaceholder')"
                        style="margin-bottom: 12px;"
                    />

                    <n-flex justify="end" align="center" :wrap="false" style="gap: 8px;">
                        <n-text depth="3">{{ t('console.output') }}:</n-text>
                        <n-select
                            v-model:value="outputFormat"
                            :options="[
                                { label: t('console.formatHex'), value: 'hex' },
                                { label: t('console.formatAscii'), value: 'ascii' },
                            ]"
                            style="width: 160px"
                        />
                    </n-flex>
                </div>
            </n-flex>

            <n-modal
                v-model:show="snippetsOpen"
                preset="card"
                :title="snippetKind === 'tag' ? t('console.snippetsTagTitle') : t('console.snippetsAdapterTitle')"
                style="width: 720px"
            >
                <n-flex vertical style="gap: 12px">
                    <n-text v-if="snippets.error" type="error">{{ snippets.error }}</n-text>
                    <n-text v-else-if="snippets.loading" depth="3">{{ t('console.loadingSnippets') }}</n-text>
                    <n-text v-else-if="snippetList.length === 0" depth="3">{{ t('console.noSnippets') }}</n-text>
                    <n-list v-else bordered>
                        <n-list-item v-for="s in snippetList" :key="s.name" @click="onInsertSnippet(s.code)">
                            <n-flex vertical style="gap: 4px">
                                <n-text strong>{{ s.name }}</n-text>
                                <n-text depth="3" v-if="s.description">{{ s.description }}</n-text>
                                <n-text depth="3" v-else-if="s.usageName">{{ s.usageName }}</n-text>
                            </n-flex>
                        </n-list-item>
                    </n-list>

                    <n-flex justify="end">
                        <n-button :loading="insertingSnippet" @click="snippetsOpen = false">{{ t('common.cancel') }}</n-button>
                    </n-flex>
                </n-flex>
            </n-modal>
        </n-card>
        
        <input
            ref="fileInputRef"
            type="file"
            accept="text/*"
            style="display: none"
            @change="onLoadCommandsSelected"
        />
    </n-flex>
</template>
