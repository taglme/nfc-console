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
  NCollapse,
  NCollapseItem,
  NDescriptions,
  NDescriptionsItem,
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
  SaveOutline,
  WifiOutline,
  TerminalOutline,
  SearchOutline,
  CreateOutline,
  CopyOutline,
  SettingsOutline,
  MoonOutline,
  SunnyOutline,
  InformationCircleOutline,
} from '@vicons/ionicons5';

import { useAppStore } from './stores/app';
import { useAdaptersStore } from './stores/adapters';
import { useAboutStore } from './stores/about';
import { useLicenseStore } from './stores/license';
import { useSettingsStore } from './stores/settings';
import { useWsStore } from './stores/ws';
import { startWsBridge } from './services/wsBridge';
import { resetSdk, getSdk } from './services/sdk';
import { useRunsStore } from './stores/runs';
import { useRateLimitStore } from './stores/rateLimit';
import { useSnippetsStore } from './stores/snippets';
import JobStatusModal from './components/JobStatusModal.vue';

const router = useRouter();
const route = useRoute();

const winMin = () => (window as any).runtime?.WindowMinimise?.();
const winMax = () => (window as any).runtime?.WindowToggleMaximise?.();
const winClose = () => (window as any).runtime?.Quit?.();

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
const showAboutModal = ref(false);

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

const themeOverrides = computed<GlobalThemeOverrides>(() => {
  const isDark = settings.theme === 'dark';
  
  // Base primary colors for text, highlights, outlines, and menus (MUST be readable!)
  const primaryText = isDark ? '#ffaa80' : '#e66b3c';
  const primaryTextHover = isDark ? '#ffbea3' : '#ff8554';
  const primaryTextPressed = isDark ? '#f28e5c' : '#bd5028';
  
  // Specific dark colors ONLY for solid Button backgrounds
  const buttonBg = isDark ? '#e66b3c' : '#e66b3c';
  const buttonBgHover = isDark ? '#ff8554' : '#ff8554';
  const buttonBgPressed = isDark ? '#bd5028' : '#bd5028';

  const activeBg = 'transparent';
  const activeHoverBg = isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(243, 243, 245, 1)';

  return {
    common: {
      borderRadius: '8px',
      primaryColor: primaryText,
      primaryColorHover: primaryTextHover,
      primaryColorPressed: primaryTextPressed,
      primaryColorSuppl: primaryTextHover,
      fontSize: '12px',
      fontSizeMini: '10px',
      fontSizeTiny: '10px',
      fontSizeSmall: '12px',
      fontSizeMedium: '12px',
      fontSizeLarge: '13px',
      fontSizeHuge: '14px',
    },
    Card: {
      borderRadius: '12px',
      fontSizeSmall: '12px',
      fontSizeMedium: '12px',
      fontSizeLarge: '12px',
      fontSizeHuge: '12px',
      titleFontSizeSmall: '16px',
      titleFontSizeMedium: '16px',
      titleFontSizeLarge: '16px',
      titleFontSizeHuge: '16px',
    },
    Dialog: {
      titleFontSize: '16px',
      fontSize: '12px',
    },
    List: {
      fontSize: '12px',
    },
    Descriptions: {
      fontSizeSmall: '12px',
      fontSizeMedium: '12px',
      fontSizeLarge: '12px',
    },
    Button: {
      textColorPrimary: '#ffffff',
      textColorHoverPrimary: '#ffffff',
      textColorPressedPrimary: '#ffffff',
      textColorFocusPrimary: '#ffffff',
      colorPrimary: buttonBg,
      colorHoverPrimary: buttonBgHover,
      colorPressedPrimary: buttonBgPressed,
      colorFocusPrimary: buttonBgHover,
      borderPrimary: `1px solid ${buttonBg}`,
      borderHoverPrimary: `1px solid ${buttonBgHover}`,
      borderPressedPrimary: `1px solid ${buttonBgPressed}`,
      borderFocusPrimary: `1px solid ${buttonBgHover}`,
    },
    Menu: {
      itemColorActive: activeBg,
      itemColorActiveHover: activeHoverBg,
      itemColorActiveCollapsed: activeBg,
      itemTextColorActive: primaryText,
      itemIconColorActive: primaryText,
      itemIndicatorColor: 'transparent',
      itemIndicatorColorHover: 'transparent',
      itemIndicatorColorActive: 'transparent',
      itemIndicatorColorActiveHover: 'transparent',
      borderRadius: '8px',
    },
    Input: {
      border: '1px solid transparent',
      borderHover: '1px solid transparent',
      color: 'var(--n-border-color)',
      colorFocus: 'var(--n-border-color)',
    },
    Select: {
      peers: {
        InternalSelection: {
          border: '1px solid transparent',
          borderHover: '1px solid transparent',
          color: 'var(--n-border-color)',
          colorActive: 'var(--n-border-color)',
        }
      }
    }
  };
});

const headerStyle = computed(() => ({
  backgroundColor: themeVars.value.primaryColor,
  color: themeVars.value.baseColor,
}));

const appKeyStatus = computed(() => {
  if (!app.embeddedAppKeyLoaded) return t('common.statusLoading');
  if (app.embeddedAppKey.trim().length === 0) return t('common.statusMissing');
  return t('common.statusOk');
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

  const { host: currHost, port: currPort } = parseBaseUrlToHostPort(settings.baseUrl);
  if (host !== currHost || port !== currPort) {
    applyBaseUrl(buildBaseUrlFromHostPort(host, port));
  } else {
    resetSdk();
    ws.reset();
    void Promise.all([about.refresh(), license.refreshAccess(), adapters.refresh()]);
  }

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
  
  const sdk = getSdk();
  sdk.setLocale(next);
  if (ws.connected) {
    try {
      sdk.Ws.setLocale(next);
    } catch (e) {
      console.error('Failed to set ws locale', e);
    }
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
  await app.loadDevFlags();

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
  <n-config-provider :theme="theme" :theme-overrides="themeOverrides" :locale="nLocale" :style="{ '--app-primary-color': themeOverrides.common?.primaryColor }">
    <div style="display: flex; flex-direction: column; height: 100vh;">
      <!-- Custom Titlebar -->
      <div 
        style="height: 48px; width: 100%; display: flex; align-items: center; --wails-draggable: drag; z-index: 100; user-select: none; position: relative;"
        :style="{ 
          backgroundColor: settings.theme === 'dark' ? '#202026' : '#fafafa', 
          color: settings.theme === 'dark' ? '#dcdcdc' : '#333',
          borderBottom: settings.theme === 'dark' ? '1px solid #333' : '1px solid #e0e0e0'
        }"
      >
        <!-- Left: Brand -->
        <div style="flex: 1; display: flex; align-items: center; gap: 8px; padding-left: 16px;">
           <img :src="settings.theme === 'dark' ? logoDark : logoLight" alt="logo" style="width: 24px; height: 24px; object-fit: contain;" />
           <span style="font-weight: 800; font-size: 15px;">Console</span>
        </div>

        <!-- Center: Adapter Selection -->
        <div style="flex: 1; display: flex; justify-content: center; align-items: center; gap: 4px;">
           <div style="--wails-draggable: no-drag;">
             <n-select
              size="small"
              :value="adapters.selectedAdapter ? adapters.selectedAdapterId : null"
              :options="adapters.options"
              :loading="adapters.loading"
              :placeholder="t('console.targetAdapter')"
              style="width: 280px"
              :theme-overrides="{
                peers: {
                  InternalSelection: {
                    color: settings.theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                    colorActive: settings.theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.07)',
                    border: '1px solid transparent',
                    borderHover: '1px solid transparent',
                    borderFocus: '1px solid transparent',
                    boxShadowFocus: 'none',
                    boxShadowActive: 'none',
                    paddingSingle: '0 12px',
                    borderRadius: '8px',
                    fontSizeSmall: '12px'
                  }
                }
              }"
              @update:show="(show) => { if (show) adapters.refresh() }"
              @update:value="(v) => adapters.select(v || '')"
            />
           </div>
        </div>

        <!-- Right: Actions & Window Controls -->
        <div style="flex: 1; display: flex; justify-content: flex-end; height: 100%; align-items: center;">
          <div style="display: flex; height: 100%; align-items: center; gap: 8px; --wails-draggable: no-drag;">
            <n-tag
            size="small"
            :bordered="false"
            round
            :type="wsIndicatorType as any"
            style="cursor: pointer; user-select: none;"
            @click="openConnectionSettings"
          >
            <div style="display: flex; align-items: center; gap: 4px; line-height: 1; font-size: 12px;">
              <n-icon :component="WifiOutline" />
              <span>{{ wsIndicatorText }}</span>
            </div>
          </n-tag>
          
          <n-button
            quaternary
            size="small"
            @click="setLocale(settings.locale === 'en' ? 'ru' : 'en')"
            style="font-weight: bold; font-size: 12px; padding: 0 6px;"
            :focusable="false"
          >
            {{ settings.locale.toUpperCase() }}
          </n-button>
          
          <div style="display: flex; height: 100%; margin-left: 4px;">
            <div class="win-btn" @click="winMin">
              <svg viewBox="0 0 12 12" width="12" height="12"><path d="M0,6 L12,6" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
            </div>
            <div class="win-btn" @click="winMax">
              <svg viewBox="0 0 12 12" width="12" height="12"><rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
            </div>
            <div class="win-btn win-close" @click="winClose">
              <svg viewBox="0 0 12 12" width="12" height="12"><path d="M1,1 L11,11 M11,1 L1,11" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>
            </div>
          </div>
          </div>
        </div>
      </div>
      
      <!-- Body -->
      <div style="flex: 1; min-height: 0;">
        <n-message-provider>
          <JobStatusModal />
          <n-layout has-sider style="height: 100%;">

        <!-- Sidebar -->
        <n-layout-sider
          collapse-mode="width"
          :collapsed-width="64"
          :width="220"
          :native-scrollbar="false"
          show-trigger="bar"
          v-model:collapsed="isCollapsed"
          content-style="display: flex; flex-direction: column; height: 100%;"
          :style="{ backgroundColor: settings.theme === 'dark' ? '#202026' : '#fafafa' }"
        >
          <n-menu
            :collapsed-width="64"
            :collapsed-icon-size="22"
            :options="menuOptions"
            :value="activeMenuKey"
            @update:value="onMenuSelect"
            style="margin-top: 12px;"
          />

          <!-- Bottom Actions (Theme) -->
          <div style="padding: 12px; margin-top: auto;">
            <n-button
              quaternary
              :style="isCollapsed ? 'width: 100%; justify-content: center; padding: 0;' : 'width: 100%; justify-content: flex-start; padding: 0 16px; font-size: 12px;'"
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
          


          <n-layout-content
              :content-style="{ padding: '24px', paddingBottom: '32px', backgroundColor: settings.theme === 'dark' ? '#101014' : '#f5f5f5', minHeight: '100%' }"
              :native-scrollbar="false"
              style="flex: 1; overflow: hidden;"
          >
            <div style="max-width: 1200px; margin: 0 auto; width: 100%;">
                <router-view />
            </div>
          </n-layout-content>

          <n-layout-footer position="absolute" style="padding: 4px 16px; font-size: 11px; bottom: 0; z-index: 1;">
             <n-flex :wrap="false" justify="space-between" align="center">
               <n-flex :wrap="true" style="gap: 16px;">
                 <n-text depth="3" style="font-size: 11px;">
                   {{ t('common.version') }}: {{ about.info?.version || '—' }}
                 </n-text>
                 <n-text depth="3" style="font-size: 11px;">
                   {{ t('common.tier') }}: {{ license.hostTier }}
                 </n-text>
                 <n-text depth="3" style="font-size: 11px;">
                   {{ t('common.appKey') }}: {{ appKeyStatus }}
                 </n-text>
               </n-flex>
               <n-button text size="tiny" @click="showAboutModal = true" style="font-size: 11px;">
                 <n-icon size="14"><InformationCircleOutline /></n-icon>
                 <span style="margin-left: 4px">{{ t('about.hostInfo') }}</span>
               </n-button>
             </n-flex>
          </n-layout-footer>
        </n-layout>

        <n-modal
          v-model:show="showConnectionModal"
          preset="card"
          :title="t('common.connectionSettings')"
          style="width: 360px"
        >
          <n-flex vertical style="gap: 16px">
            <n-alert v-if="ws.lastError" type="error" :show-icon="false" style="padding: 8px 12px; font-size: 12px;">
              {{ ws.lastError === 'CONNECT_REFUSED' ? t('common.wsConnectRefused') : ws.lastError }}
            </n-alert>
            <n-flex align="center" :wrap="false" style="gap: 12px">
              <n-text style="width: 90px">{{ t('common.ipAddress') }}</n-text>
              <n-input v-model:value="hostDraft" placeholder="127.0.0.1" style="flex: 1" @keyup.enter="saveConnectionSettings" />
            </n-flex>
            <n-flex align="center" :wrap="false" style="gap: 12px">
              <n-text style="width: 90px">{{ t('common.port') }}</n-text>
              <n-input-number v-model:value="portDraft" :show-button="false" :min="1" :max="65535" style="flex: 1" @keyup.enter="saveConnectionSettings" />
            </n-flex>
            <n-button type="primary" block @click="saveConnectionSettings">
              {{ t('common.connectWs') }}
            </n-button>
          </n-flex>
        </n-modal>

        <n-modal
          v-model:show="showAboutModal"
          preset="card"
          :title="t('about.hostInfo')"
          style="width: 500px"
        >
          <n-descriptions label-placement="left" :column="1" bordered size="small">
             <n-descriptions-item :label="t('about.name')">{{ (about.info as any)?.hostName || '—' }}</n-descriptions-item>
             <n-descriptions-item :label="t('about.version')">{{ about.info ? `${about.info.name} ${about.info.version}` : '—' }}</n-descriptions-item>
             <n-descriptions-item :label="t('about.mid')">{{ license.license?.machine || '—' }}</n-descriptions-item>
          </n-descriptions>
          <n-collapse style="margin-top: 16px;">
             <n-collapse-item :title="t('about.licenseDetails')" name="1">
               <n-descriptions label-placement="left" :column="1" bordered size="small">
                  <n-descriptions-item :label="t('about.licenseId')">{{ license.license?.id || '—' }}</n-descriptions-item>
                  <n-descriptions-item :label="t('about.licenseStart')">{{ license.license?.start || '—' }}</n-descriptions-item>
                  <n-descriptions-item :label="t('about.licenseEnd')">{{ license.license?.end || '—' }}</n-descriptions-item>
                  <n-descriptions-item :label="t('about.supportEnd')">{{ license.license?.support || '—' }}</n-descriptions-item>
                  <n-descriptions-item :label="t('about.plugins')">
                     <span v-if="license.license?.plugins?.length">{{ license.license.plugins.join(', ') }}</span>
                     <span v-else>—</span>
                  </n-descriptions-item>
                  <n-descriptions-item :label="t('about.type')">{{ license.license?.type || '—' }}</n-descriptions-item>
                  <n-descriptions-item :label="t('about.tier')">{{ license.hostTier }}</n-descriptions-item>
               </n-descriptions>
             </n-collapse-item>
          </n-collapse>
        </n-modal>
        </n-layout>
        </n-message-provider>
      </div>
    </div>
  </n-config-provider>
</template>
