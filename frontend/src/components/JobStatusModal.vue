<script setup lang="ts">
import { computed } from 'vue';
import { NAlert, NButton, NCard, NFlex, NGrid, NGridItem, NIcon, NModal, NText } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { CalendarOutline, CheckmarkCircleOutline, AlertCircleOutline } from '@vicons/ionicons5';

import { useJobModalStore } from '../stores/jobModal';
import { useSettingsStore } from '../stores/settings';

const { t } = useI18n();
const jobModal = useJobModalStore();
const settings = useSettingsStore();

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

const customAlertStyle = computed(() => {
    const isDark = settings.theme === 'dark';
    switch (jobModal.status) {
        case 'pending':
            return { 
                backgroundColor: isDark ? 'rgba(32, 128, 240, 0.3)' : 'rgba(32, 128, 240, 0.15)',
                color: isDark ? '#7dbdff' : '#0061d4' 
            };
        case 'activated':
            return { 
                backgroundColor: isDark ? 'rgba(240, 160, 32, 0.3)' : 'rgba(240, 160, 32, 0.15)',
                color: isDark ? '#fbcd64' : '#b87500' 
            };
        case 'finished':
            return { 
                backgroundColor: isDark ? 'rgba(24, 160, 88, 0.3)' : 'rgba(24, 160, 88, 0.15)',
                color: isDark ? '#5bc983' : '#107a41' 
            };
        case 'error':
        case 'deleted':
            return { 
                backgroundColor: isDark ? 'rgba(208, 48, 80, 0.3)' : 'rgba(208, 48, 80, 0.15)',
                color: isDark ? '#fc7e94' : '#b31535' 
            };
        default:
            return {};
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
function onUpdateShow(value: boolean) {
    if (!value) {
        void jobModal.close('user');
    }
}
</script>

<template>
    <n-modal :show="jobModal.open" @update:show="onUpdateShow" preset="card" :title="jobModal.jobName" style="width: 560px" @close="onClose">
        <n-flex vertical size="large">
            <n-alert :type="alertType" :show-icon="false" :bordered="false" style="padding: 24px; border-radius: 12px;" :style="customAlertStyle">
                <div style="white-space: pre-wrap; word-break: break-word; text-align: center; font-weight: 600; font-size: 20px;" :style="{ color: customAlertStyle.color }">
                    {{ statusText }}
                </div>
            </n-alert>

            <n-grid :x-gap="12" :y-gap="12" :cols="3" responsive="screen">
                <n-grid-item style="display: flex;">
                    <n-card size="small" :bordered="false" style="background-color: var(--n-color-embedded); border-radius: 12px; flex: 1;" content-style="padding: 12px 16px; display: flex; align-items: center;">
                        <n-flex align="center" :wrap="false" style="gap: 10px;">
                            <n-icon size="24" :component="CalendarOutline" />
                            <div>
                                <div style="font-weight: 700; font-size: 16px; line-height: 1.2;">{{ jobModal.counters.repeat }}</div>
                                <n-text depth="3" style="font-size: 12px; line-height: 1.2;">{{ t('jobModal.scheduled') }}</n-text>
                            </div>
                        </n-flex>
                    </n-card>
                </n-grid-item>
                <n-grid-item style="display: flex;">
                    <n-card size="small" :bordered="false" style="background-color: var(--n-color-embedded); border-radius: 12px; flex: 1;" content-style="padding: 12px 16px; display: flex; align-items: center;">
                        <n-flex align="center" :wrap="false" style="gap: 10px;">
                            <n-icon size="24" :component="CheckmarkCircleOutline" />
                            <div>
                                <div style="font-weight: 700; font-size: 16px; line-height: 1.2;">{{ jobModal.counters.success_runs }}</div>
                                <n-text depth="3" style="font-size: 12px; line-height: 1.2;">{{ t('jobModal.success') }}</n-text>
                            </div>
                        </n-flex>
                    </n-card>
                </n-grid-item>
                <n-grid-item style="display: flex;">
                    <n-card size="small" :bordered="false" style="background-color: var(--n-color-embedded); border-radius: 12px; flex: 1;" content-style="padding: 12px 16px; display: flex; align-items: center;">
                        <n-flex align="center" :wrap="false" style="gap: 10px;">
                            <n-icon size="24" :component="AlertCircleOutline" />
                            <div>
                                <div style="font-weight: 700; font-size: 16px; line-height: 1.2;">{{ jobModal.counters.error_runs }}</div>
                                <n-text depth="3" style="font-size: 12px; line-height: 1.2;">{{ t('jobModal.failed') }}</n-text>
                            </div>
                        </n-flex>
                    </n-card>
                </n-grid-item>
            </n-grid>
        </n-flex>
    </n-modal>
</template>
