<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import {
  NButton,
  NConfigProvider,
  NFlex,
  NInput,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NSelect,
  NMenu,
  NMessageProvider,
  NText,
  createDiscreteApi,
} from 'naive-ui';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

import { useAppStore } from './stores/app';
import { useAdaptersStore } from './stores/adapters';
import { useAboutStore } from './stores/about';
import { useLicenseStore } from './stores/license';
import { useSettingsStore } from './stores/settings';
import { useWsStore } from './stores/ws';
import { startWsBridge } from './services/wsBridge';
import { resetSdk } from './services/sdk';
import { useRunsStore } from './stores/runs';
import { useRateLimitStore } from './stores/rateLimit';
import { useSnippetsStore } from './stores/snippets';

const router = useRouter();
const route = useRoute();

const app = useAppStore();
const settings = useSettingsStore();
const adapters = useAdaptersStore();
const about = useAboutStore();
const license = useLicenseStore();
const ws = useWsStore();
const runs = useRunsStore();
const rateLimit = useRateLimitStore();
const snippets = useSnippetsStore();

const { message } = createDiscreteApi(['message']);

const { t, locale } = useI18n();

const baseUrlDraft = ref(settings.baseUrl);
const localeDraft = ref<'en' | 'ru'>(settings.locale);

const menuOptions = computed(() => [
  { label: t('menu.console'), key: '/' },
  { label: t('menu.read'), key: '/read' },
  { label: t('menu.write'), key: '/write' },
  { label: t('menu.dump'), key: '/dump' },
  { label: t('menu.other'), key: '/other' },
]);

const activeMenuKey = computed(() => route.path);

const appKeyStatus = computed(() => {
  if (!app.embeddedAppKeyLoaded) return 'loading';
  if (app.embeddedAppKey.trim().length === 0) return 'missing';
  return 'ok';
});

function onMenuSelect(key: string) {
  router.push(key);
}

function applyBaseUrl() {
  settings.setBaseUrl(baseUrlDraft.value.trim());
  message.success(t('app.baseUrlSaved'));

  // Reset cached instances/state so next requests use the new server.
  resetSdk();
  ws.reset();
  runs.clear();
  rateLimit.reset();
  snippets.reset();

  // Refresh metadata and adapter list from the new base URL.
  void Promise.all([about.refresh(), license.refreshAccess(), adapters.refresh()]);
}

function applyLocale() {
  settings.setLocale(localeDraft.value);
  locale.value = localeDraft.value;

  resetSdk();
  ws.reset();
  runs.clear();
  rateLimit.reset();
  snippets.reset();

  void Promise.all([about.refresh(), license.refreshAccess(), adapters.refresh()]);
}

function connectWs() {
  if (app.embeddedAppKey.trim().length === 0) {
    message.error(t('app.missingAppKey'));
    return;
  }
  ws.connect();
}

function disconnectWs() {
  ws.disconnect();
}

onMounted(async () => {
  startWsBridge();
  await app.loadEmbeddedAppKey();

  locale.value = settings.locale;

  if (app.embeddedAppKey.trim().length === 0) {
    message.warning(t('app.appKeyMissingWarn'));
  }

  await Promise.all([about.refresh(), license.refreshAccess(), adapters.refresh()]);
});
</script>

<template>
  <n-config-provider>
    <n-message-provider>
      <n-layout style="height: 100vh">
        <n-layout-header bordered style="padding: 12px 16px">
          <n-flex align="center" justify="space-between" :wrap="false">
            <n-flex align="center" :wrap="false" style="gap: 16px">
              <n-text strong>{{ t('app.title') }}</n-text>
              <n-menu
                mode="horizontal"
                :options="menuOptions"
                :value="activeMenuKey"
                @update:value="onMenuSelect"
              />
            </n-flex>

            <n-flex align="center" :wrap="false" style="gap: 12px">
              <n-input
                v-model:value="baseUrlDraft"
                placeholder="http://127.0.0.1:3011"
                style="width: 280px"
              />
              <n-button type="primary" @click="applyBaseUrl">{{ t('common.apply') }}</n-button>

              <n-select
                v-model:value="localeDraft"
                :options="[
                  { label: 'EN', value: 'en' },
                  { label: 'RU', value: 'ru' }
                ]"
                style="width: 90px"
              />
              <n-button @click="applyLocale">{{ localeDraft.toUpperCase() }}</n-button>

              <n-select
                :value="adapters.selectedAdapterId"
                :options="adapters.options"
                placeholder="Select adapter"
                clearable
                style="width: 260px"
                @update:value="(v) => adapters.select(v || '')"
              />
              <n-button v-if="!ws.connected" @click="connectWs">{{ t('common.connectWs') }}</n-button>
              <n-button v-else @click="disconnectWs">{{ t('common.disconnect') }}</n-button>
              <n-text depth="3">App key: {{ appKeyStatus }}</n-text>
            </n-flex>
          </n-flex>
        </n-layout-header>

        <n-layout-content style="padding: 16px">
          <n-flex :wrap="true" style="gap: 8px; margin-bottom: 12px">
            <n-text depth="3">
              {{ t('common.host') }}: {{ about.info?.hostName || '—' }}
            </n-text>
            <n-text depth="3">
              {{ t('common.version') }}: {{ about.info?.version || '—' }}
            </n-text>
            <n-text depth="3">
              {{ t('common.tier') }}: {{ license.hostTier }}
            </n-text>
            <n-text depth="3">
              {{ t('common.ws') }}: {{ ws.connected ? t('common.connected') : t('common.disconnected') }}
            </n-text>
            <n-text v-if="ws.lastError" depth="3">WS error: {{ ws.lastError }}</n-text>
          </n-flex>
          <router-view />
        </n-layout-content>
      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>
