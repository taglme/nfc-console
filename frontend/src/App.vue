<script lang="ts" setup>
import { computed, onMounted, ref, h, Component } from 'vue';
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
  NLayoutSider,
  NModal,
  NSelect,
  NMenu,
  NMessageProvider,
  NText,
  createDiscreteApi,
  darkTheme,
  NTag,
  useThemeVars,
  GlobalThemeOverrides,
  ruRU,
  enUS,
} from 'naive-ui';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

import logoLight from './assets/images/logo_c.png';
import logoDark from './assets/images/logo_w.png';

import {
  RefreshOutline,
  SaveOutline,
  WifiOutline,
  TerminalOutline,
  SearchOutline,
  CreateOutline,
  CopyOutline,
  SettingsOutline,
  MoonOutline,
  SunnyOutline,
} from '@vicons/ionicons5';

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
import JobStatusModal from './components/JobStatusModal.vue';

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

const isCollapsed = ref(false);

const showConnectionModal = ref(false);
const hostDraft = ref('127.0.0.1');
const portDraft = ref<number>(3011);

const localeOptions = [
  { label: 'EN', value: 'en' },
  { label: 'RU', value: 'ru' },
] as const;

function renderIcon(icon: Component) {
  return () => h(NIcon, null, { default: () => h(icon) });
}

const menuOptions = computed(() => [
  { label: t('menu.console'), key: '/', icon: renderIcon(TerminalOutline) },
  { label: t('menu.read'), key: '/read', icon: renderIcon(SearchOutline) },
  { label: t('menu.write'), key: '/write', icon: renderIcon(CreateOutline) },
  { label: t('menu.dump'), key: '/dump', icon: renderIcon(CopyOutline) },
  { label: t('menu.other'), key: '/other', icon: renderIcon(SettingsOutline) },
]);

const activeMenuKey = computed(() => route.path);

const theme = computed(() => (settings.theme === 'dark' ? darkTheme : null));
const nLocale = computed(() => (locale.value === 'ru' ? ruRU : enUS));

const themeOverrides: GlobalThemeOverrides = {
  common: {
    borderRadius: '8px',
    primaryColor: '#348be0',
    primaryColorHover: '#52a2f0',
    primaryColorPressed: '#226db8',
    primaryColorSuppl: '#52a2f0',
  },
  Card: {
    borderRadius: '12px',
  },
  Button: {
    textColorPrimary: '#ffffff',
    textColorHoverPrimary: '#ffffff',
    textColorPressedPrimary: '#ffffff',
    textColorFocusPrimary: '#ffffff',
    colorPrimary: '#348be0',
    colorHoverPrimary: '#52a2f0',
    colorPressedPrimary: '#226db8',
    colorFocusPrimary: '#52a2f0',
    borderPrimary: '1px solid #348be0',
    borderHoverPrimary: '1px solid #52a2f0',
    borderPressedPrimary: '1px solid #226db8',
    borderFocusPrimary: '1px solid #52a2f0',
  },
  Menu: {
    itemColorActive: 'transparent',
    itemColorActiveHover: 'transparent',
    itemColorActiveCollapsed: 'transparent',
    itemTextColorActive: '#348be0',
    itemIconColorActive: '#348be0',
  }
};

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

  const { host: currHost, port: currPort } = parseBaseUrlToHostPort(settings.baseUrl);
  if (host === currHost && port === currPort) {
    showConnectionModal.value = false;
    return;
  }

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
  <n-config-provider :theme="theme" :theme-overrides="themeOverrides" :locale="nLocale">
    <n-message-provider>
      <JobStatusModal />
      <n-layout has-sider style="height: 100vh;">

        <!-- Sidebar -->
        <n-layout-sider
          bordered
          collapse-mode="width"
          :collapsed-width="64"
          :width="220"
          :native-scrollbar="false"
          show-trigger="bar"
          v-model:collapsed="isCollapsed"
          content-style="display: flex; flex-direction: column; height: 100%;"
        >
          <!-- Brand -->
          <n-flex align="center" justify="center" style="height: 64px; box-sizing: border-box; border-bottom: 1px solid var(--n-border-color); overflow: hidden;">
             <div style="display: flex; align-items: center; white-space: nowrap; gap: 8px;">
                <img :src="settings.theme === 'dark' ? logoDark : logoLight" alt="logo" style="width: 32px; height: 32px; object-fit: contain;" />
                <span v-if="!isCollapsed" style="font-weight: 800; font-size: 18px;">Console</span>
             </div>
          </n-flex>

          <n-menu
            :collapsed-width="64"
            :collapsed-icon-size="22"
            :options="menuOptions"
            :value="activeMenuKey"
            @update:value="onMenuSelect"
            style="margin-top: 12px;"
          />

          <!-- Bottom Actions (Theme) -->
          <div style="padding: 12px; border-top: 1px solid var(--n-border-color); margin-top: auto;">
            <n-button
              quaternary
              :style="isCollapsed ? 'width: 100%; justify-content: center; padding: 0;' : 'width: 100%; justify-content: flex-start; padding: 0 16px; font-size: 14px;'"
              @click="settings.setTheme(settings.theme === 'dark' ? 'light' : 'dark')"
            >
               <template #icon>
                  <n-icon size="22" :component="settings.theme === 'dark' ? SunnyOutline : MoonOutline" />
               </template>
               <span v-if="!isCollapsed" style="margin-left: 8px;">{{ t('menu.theme') }}</span>
            </n-button>
          </div>
        </n-layout-sider>

        <!-- Main Layout -->
        <n-layout content-style="display: flex; flex-direction: column; height: 100%;">
          
          <!-- Header -->
          <n-layout-header bordered style="height: 64px; padding: 0 24px;">
             <n-flex align="center" justify="space-between" style="height: 100%;">
                
                <!-- Center / Search / Adapters -->
                <n-flex align="center" :wrap="false" style="gap: 4px;">
                   <n-select
                      size="small"
                      :value="adapters.selectedAdapterId"
                      :options="adapters.options"
                      :loading="adapters.loading"
                      :disabled="adapters.loading"
                      :placeholder="t('console.targetAdapter')"
                      clearable
                      style="width: 280px"
                      @update:value="(v) => adapters.select(v || '')"
                    />
                    <n-button size="small" quaternary circle :disabled="adapters.loading" @click="adapters.refresh()">
                      <template #icon>
                        <n-icon :component="RefreshOutline" />
                      </template>
                    </n-button>
                </n-flex>

                <!-- Right Actions -->
                <n-flex align="center" :wrap="false" style="gap: 12px;">

                  <n-button
                    quaternary
                    size="small"
                    @click="setLocale(settings.locale === 'en' ? 'ru' : 'en')"
                    style="font-weight: bold; font-size: 14px; padding: 0 6px;"
                  >
                    {{ settings.locale.toUpperCase() }}
                  </n-button>

                  <n-tag
                    size="small"
                    :bordered="false"
                    round
                    :type="wsIndicatorType as any"
                    style="cursor: pointer; user-select: none"
                    @click="openConnectionSettings"
                  >
                    <n-icon :component="WifiOutline" style="margin-right: 6px" />
                    {{ wsIndicatorText }}
                  </n-tag>
                </n-flex>
             </n-flex>
          </n-layout-header>

          <n-layout-content
              :content-style="{ padding: '24px', paddingBottom: '32px', backgroundColor: settings.theme === 'dark' ? '#101014' : '#f5f7fa', minHeight: '100%' }"
              :native-scrollbar="false"
          >
            <div style="max-width: 1200px; margin: 0 auto; width: 100%;">
                <router-view />
            </div>
          </n-layout-content>

          <n-layout-footer bordered position="absolute" style="padding: 4px 16px; font-size: 11px; bottom: 0; z-index: 1;">
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
        </n-layout>

        <n-modal
          v-model:show="showConnectionModal"
          preset="card"
          :title="t('common.connectionSettings')"
          style="width: 360px"
          @after-leave="saveConnectionSettings"
        >
          <n-flex vertical style="gap: 12px">
            <n-flex align="center" :wrap="false" style="gap: 12px">
              <n-text style="width: 90px">{{ t('common.ipAddress') }}</n-text>
              <n-input v-model:value="hostDraft" placeholder="127.0.0.1" style="flex: 1" />
            </n-flex>
            <n-flex align="center" :wrap="false" style="gap: 12px">
              <n-text style="width: 90px">{{ t('common.port') }}</n-text>
              <n-input-number v-model:value="portDraft" :show-button="false" :min="1" :max="65535" style="flex: 1" />
            </n-flex>
          </n-flex>
        </n-modal>

      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>
