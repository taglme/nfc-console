<script setup lang="ts">
import { computed } from 'vue';
import { NAlert, NButton, NCard, NFlex, NGrid, NGridItem, NIcon, NModal, NText } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { CalendarOutline, CheckmarkCircleOutline, AlertCircleOutline } from '@vicons/ionicons5';

import { useJobModalStore } from '../stores/jobModal';

const { t } = useI18n();
const jobModal = useJobModalStore();

const alertType = computed(() => {
    switch (jobModal.status) {
        case 'pending':
            return 'info' as const;
        case 'activated':
            return 'warning' as const;
        case 'finished':
            return 'success' as const;
        case 'error':
        case 'deleted':
            return 'error' as const;
        default:
            return 'info' as const;
    }
});

const statusText = computed(() => {
    switch (jobModal.status) {
        case 'pending':
            return t('jobModal.pending');
        case 'activated':
            return t('jobModal.activated');
        case 'finished':
            return t('jobModal.finished');
        case 'deleted':
            return t('jobModal.deleted');
        case 'error':
            return t('jobModal.error', { errorMessage: jobModal.errorMessage || '' });
        default:
            return '';
    }
});

function onClose() {
    void jobModal.close('user');
}
</script>

<template>
    <n-modal v-model:show="jobModal.open" preset="card" :title="jobModal.jobName" style="width: 560px" @close="onClose">
        <n-flex vertical size="large">
            <n-alert :type="alertType" :show-icon="false">
                <div style="white-space: pre-wrap; word-break: break-word; text-align: center; font-weight: 600;">
                    {{ statusText }}
                </div>
            </n-alert>

            <n-grid :x-gap="12" :y-gap="12" :cols="3" responsive="screen">
                <n-grid-item>
                    <n-card size="small" :bordered="true" content-style="padding: 16px;">
                        <n-flex align="center" :wrap="false" style="gap: 10px;">
                            <n-icon size="24" :component="CalendarOutline" />
                            <div>
                                <div style="font-weight: 700; font-size: 16px;">{{ jobModal.counters.repeat }}</div>
                                <n-text depth="3">{{ t('jobModal.scheduled') }}</n-text>
                            </div>
                        </n-flex>
                    </n-card>
                </n-grid-item>
                <n-grid-item>
                    <n-card size="small" :bordered="true" content-style="padding: 16px;">
                        <n-flex align="center" :wrap="false" style="gap: 10px;">
                            <n-icon size="24" :component="CheckmarkCircleOutline" />
                            <div>
                                <div style="font-weight: 700; font-size: 16px;">{{ jobModal.counters.success_runs }}</div>
                                <n-text depth="3">{{ t('jobModal.success') }}</n-text>
                            </div>
                        </n-flex>
                    </n-card>
                </n-grid-item>
                <n-grid-item>
                    <n-card size="small" :bordered="true" content-style="padding: 16px;">
                        <n-flex align="center" :wrap="false" style="gap: 10px;">
                            <n-icon size="24" :component="AlertCircleOutline" />
                            <div>
                                <div style="font-weight: 700; font-size: 16px;">{{ jobModal.counters.error_runs }}</div>
                                <n-text depth="3">{{ t('jobModal.failed') }}</n-text>
                            </div>
                        </n-flex>
                    </n-card>
                </n-grid-item>
            </n-grid>

            <n-flex justify="end">
                <n-button @click="onClose">{{ t('common.close') }}</n-button>
            </n-flex>
        </n-flex>
    </n-modal>
</template>
