<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import {
  NButton,
  NConfigProvider,
  NFlex,
  NInput,
  NInputNumber,
  NIcon,
  NLayout,
  NLayoutContent,
  NLayoutHeader,
  NLayoutFooter,
  NModal,
  NSelect,
  NMenu,
  NMessageProvider,
  NText,
  createDiscreteApi,
  darkTheme,
  NTag,
  useThemeVars,
} from 'naive-ui';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

import { RefreshOutline, SaveOutline, WifiOutline } from '@vicons/ionicons5';

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

const themeVars = useThemeVars();

const showConnectionModal = ref(false);
const hostDraft = ref('127.0.0.1');
const portDraft = ref<number>(3011);

const localeOptions = [
  { label: 'EN', value: 'en' },
  { label: 'RU', value: 'ru' },
] as const;

const menuOptions = computed(() => [
  { label: t('menu.console'), key: '/' },
  { label: t('menu.read'), key: '/read' },
  { label: t('menu.write'), key: '/write' },
  { label: t('menu.dump'), key: '/dump' },
  { label: t('menu.other'), key: '/other' },
]);

const activeMenuKey = computed(() => route.path);

const theme = computed(() => (settings.theme === 'dark' ? darkTheme : null));

const headerStyle = computed(() => ({
  backgroundColor: themeVars.value.primaryColor,
  color: themeVars.value.baseColor,
}));

const appKeyStatus = computed(() => {
  if (!app.embeddedAppKeyLoaded) return 'loading';
  if (app.embeddedAppKey.trim().length === 0) return 'missing';
  return 'ok';
});

function onMenuSelect(key: string) {
  router.push(key);
}

function applyBaseUrl(baseUrl: string) {
  settings.setBaseUrl(baseUrl.trim());
  message.success(t('app.baseUrlSaved'));

  resetSdk();
  ws.reset();
  runs.clear();
  rateLimit.reset();
  snippets.reset();

  void Promise.all([about.refresh(), license.refreshAccess(), adapters.refresh()]);
}

function parseBaseUrlToHostPort(baseUrl: string): { host: string; port: number } {
  try {
    const u = new URL(baseUrl);
    const host = u.hostname || '127.0.0.1';
    const port = u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80;
    return { host, port: Number.isFinite(port) && port > 0 ? port : 3011 };
  } catch {
    return { host: '127.0.0.1', port: 3011 };
  }
}

function buildBaseUrlFromHostPort(host: string, port: number): string {
  const safeHost = host.trim();
  const safePort = Math.trunc(port);
  return `http://${safeHost}:${safePort}`;
}

function openConnectionSettings() {
  const { host, port } = parseBaseUrlToHostPort(settings.baseUrl);
  hostDraft.value = host;
  portDraft.value = port;
  showConnectionModal.value = true;
}

function saveConnectionSettings() {
  const host = hostDraft.value.trim();
  const port = Math.trunc(portDraft.value);

  if (!host) {
    message.error(t('common.enterHost'));
    return;
  }
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    message.error(t('common.enterPort'));
    return;
  }

  applyBaseUrl(buildBaseUrlFromHostPort(host, port));
  showConnectionModal.value = false;

  if (app.embeddedAppKey.trim().length === 0) {
    message.error(t('app.missingAppKey'));
    return;
  }
  ws.connect();
}

function setLocale(next: 'en' | 'ru') {
  settings.setLocale(next);
  locale.value = next;

  resetSdk();
  ws.reset();
  runs.clear();
  rateLimit.reset();
  snippets.reset();

  void Promise.all([about.refresh(), license.refreshAccess(), adapters.refresh()]);
  if (app.embeddedAppKey.trim().length !== 0) {
    ws.connect();
  }
}

const wsIndicatorType = computed(() => {
  if (ws.connected) return 'success';
  if (ws.connecting) return 'warning';
  return 'error';
});

const wsIndicatorText = computed(() => {
  if (ws.connected) return t('common.connected');
  if (ws.connecting) return t('common.connecting');
  return t('common.disconnected');
});

onMounted(async () => {
  startWsBridge();
  await app.loadEmbeddedAppKey();

  locale.value = settings.locale;

  if (app.embeddedAppKey.trim().length === 0) {
    message.warning(t('app.appKeyMissingWarn'));
  }

  await Promise.all([about.refresh(), license.refreshAccess(), adapters.refresh()]);

  // Try WS connection on startup using current settings.
  if (app.embeddedAppKey.trim().length !== 0) {
    ws.connect();
  }
});
</script>

<template>
  <n-config-provider :theme="theme">
    <n-message-provider>
      <n-layout style="height: 100vh; display: flex; flex-direction: column;" position="absolute">
        
        <!-- Level 1: System Header -->
        <n-layout-header :style="{ ...headerStyle, padding: '0 16px', height: '56px', zIndex: 20 }">
          <n-flex align="center" justify="space-between" :wrap="false" style="height: 100%;">
            <!-- Brand -->
            <n-flex align="center" :wrap="false" style="gap: 12px">
              <div
                style="
                  font-weight: 800;
                  font-size: 18px;
                  line-height: 1;
                "
              >
                TAGLME <span style="opacity: 0.9">CONSOLE</span>
              </div>

              <n-tag size="small" :bordered="false" type="default" round>
                {{ about.info?.hostName || 'Local' }}
              </n-tag>
            </n-flex>

            <!-- Actions -->
            <n-flex align="center" :wrap="false" style="gap: 12px;">
              <n-select
                size="small"
                :value="settings.locale"
                :options="(localeOptions as any)"
                style="width: 84px"
                @update:value="(v) => setLocale((v || 'en') as any)"
              />

              <n-tag
                size="small"
                :bordered="false"
                round
                :type="wsIndicatorType as any"
                style="cursor: pointer; user-select: none"
                @click="openConnectionSettings"
              >
                <n-icon :component="WifiOutline" style="margin-right: 6px" />
                WS: {{ wsIndicatorText }}
              </n-tag>
            </n-flex>
          </n-flex>
        </n-layout-header>

        <!-- Level 2: Navigation -->
        <n-layout-header bordered style="height: 48px; padding: 0 16px; z-index: 10;">
          <n-flex align="center" justify="space-between" :wrap="false" style="height: 100%">
            <n-menu
              mode="horizontal"
              :options="menuOptions"
              :value="activeMenuKey"
              @update:value="onMenuSelect"
              style="line-height: 48px;"
            />
            <n-flex align="center" :wrap="false" style="gap: 8px">
              <n-select
                size="small"
                :value="adapters.selectedAdapterId"
                :options="adapters.options"
                :loading="adapters.loading"
                :disabled="adapters.loading"
                :placeholder="t('console.targetAdapter')"
                clearable
                style="width: 320px"
                @update:value="(v) => adapters.select(v || '')"
              />
              <n-button size="small" quaternary circle :disabled="adapters.loading" @click="adapters.refresh()">
                <template #icon>
                  <n-icon :component="RefreshOutline" />
                </template>
              </n-button>
            </n-flex>
          </n-flex>
        </n-layout-header>

        <n-layout-content
            embedded
          :content-style="{ padding: '24px', backgroundColor: themeVars.bodyColor }"
            style="flex: 1;"
        >
          <!-- Using cards logic effectively requires components inside router-view to use n-card. 
               We will assume they do or wrap them if needed, but for now just setting the canvas bg. -->
          <router-view />
        </n-layout-content>

        <n-layout-footer bordered style="padding: 4px 16px; font-size: 11px;">
           <n-flex :wrap="true" style="gap: 16px;">
            <n-text depth="3">
              {{ t('common.version') }}: {{ about.info?.version || '—' }}
            </n-text>
            <n-text depth="3">
              {{ t('common.tier') }}: {{ license.hostTier }}
            </n-text>
            <n-text depth="3">
              App key: {{ appKeyStatus }}
            </n-text>
            <n-text v-if="ws.lastError" type="error">WS Error: {{ ws.lastError }}</n-text>
          </n-flex>
        </n-layout-footer>

        <n-modal v-model:show="showConnectionModal" preset="card" :title="t('common.connectionSettings')" style="width: 520px">
          <template #header-extra>
            <n-button size="small" type="primary" quaternary circle @click="saveConnectionSettings">
              <template #icon>
                <n-icon :component="SaveOutline" />
              </template>
            </n-button>
          </template>

          <n-flex vertical style="gap: 12px">
            <n-flex align="center" :wrap="false" style="gap: 12px">
              <n-text style="width: 90px">{{ t('common.ipAddress') }}</n-text>
              <n-input v-model:value="hostDraft" placeholder="127.0.0.1" />
            </n-flex>
            <n-flex align="center" :wrap="false" style="gap: 12px">
              <n-text style="width: 90px">{{ t('common.port') }}</n-text>
              <n-input-number v-model:value="portDraft" :min="1" :max="65535" style="flex: 1" />
            </n-flex>

            <n-flex justify="end" :wrap="false" style="gap: 8px; margin-top: 4px">
              <n-button size="small" @click="showConnectionModal = false">{{ t('common.cancel') }}</n-button>
              <n-button size="small" type="primary" @click="saveConnectionSettings">{{ t('common.save') }}</n-button>
            </n-flex>
          </n-flex>
        </n-modal>

      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>
