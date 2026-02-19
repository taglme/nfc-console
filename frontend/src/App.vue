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

const { message } = createDiscreteApi(['message']);

const baseUrlDraft = ref(settings.baseUrl);

const menuOptions = [
  { label: 'Console', key: '/' },
  { label: 'Read', key: '/read' },
  { label: 'Write', key: '/write' },
  { label: 'Dump', key: '/dump' },
  { label: 'Other', key: '/other' },
];

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
  message.success('Base URL saved.');

  // Reset cached instances/state so next requests use the new server.
  resetSdk();
  ws.reset();
  runs.clear();
  rateLimit.reset();

  // Refresh metadata and adapter list from the new base URL.
  void Promise.all([about.refresh(), license.refreshAccess(), adapters.refresh()]);
}

function connectWs() {
  if (app.embeddedAppKey.trim().length === 0) {
    message.error('Missing embedded X-App-Key. Build the app with -ldflags -X main.EmbeddedAppKey=...');
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

  if (app.embeddedAppKey.trim().length === 0) {
    message.warning('App key is missing. API calls may be rejected until you rebuild with an embedded key.');
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
              <n-text strong>Taglme NFC Console</n-text>
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
              <n-button type="primary" @click="applyBaseUrl">Apply</n-button>
              <n-select
                :value="adapters.selectedAdapterId"
                :options="adapters.options"
                placeholder="Select adapter"
                clearable
                style="width: 260px"
                @update:value="(v) => adapters.select(v || '')"
              />
              <n-button v-if="!ws.connected" @click="connectWs">Connect WS</n-button>
              <n-button v-else @click="disconnectWs">Disconnect</n-button>
              <n-text depth="3">App key: {{ appKeyStatus }}</n-text>
            </n-flex>
          </n-flex>
        </n-layout-header>

        <n-layout-content style="padding: 16px">
          <n-flex :wrap="true" style="gap: 8px; margin-bottom: 12px">
            <n-text depth="3">
              Host: {{ about.info?.hostName || '—' }}
            </n-text>
            <n-text depth="3">
              Version: {{ about.info?.version || '—' }}
            </n-text>
            <n-text depth="3">
              Tier: {{ license.hostTier }}
            </n-text>
            <n-text depth="3">
              WS: {{ ws.connected ? 'connected' : 'disconnected' }}
            </n-text>
            <n-text v-if="ws.lastError" depth="3">WS error: {{ ws.lastError }}</n-text>
          </n-flex>
          <router-view />
        </n-layout-content>
      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>
