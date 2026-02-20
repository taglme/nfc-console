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
  NLayoutFooter,
  NSelect,
  NMenu,
  NMessageProvider,
  NPopover,
  NText,
  createDiscreteApi,
  darkTheme,
  NTag,
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

const theme = computed(() => (settings.theme === 'dark' ? darkTheme : null));

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

function toggleTheme() {
  const next = settings.theme === 'light' ? 'dark' : 'light';
  settings.setTheme(next);
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
  <n-config-provider :theme="theme">
    <n-message-provider>
      <n-layout style="height: 100vh; display: flex; flex-direction: column;" position="absolute">
        
        <!-- Level 1: System Header -->
        <n-layout-header bordered style="padding: 0 16px; height: 56px; z-index: 20;">
          <n-flex align="center" justify="space-between" :wrap="false" style="height: 100%;">
            <!-- Brand -->
            <n-flex align="center" :wrap="false" style="gap: 12px">
              <div
                style="
                  font-weight: 800;
                  font-size: 18px;
                  line-height: 1;
                  padding-right: 12px;
                  border-right: 1px solid var(--n-border-color);
                "
              >
                TAGLME <n-text type="primary">CONSOLE</n-text>
              </div>

               <!-- Status Badges (Compact) -->
               <n-flex size="small" align="center">
                <n-tag size="small" :bordered="false" type="default" round>
                  {{ about.info?.hostName || 'Local' }}
                </n-tag>
                 <n-tag v-if="ws.connected" size="small" :bordered="false" type="success" round>
                  Connected
                </n-tag>
                <n-tag v-else size="small" :bordered="false" type="error" round>
                  Disconnected
                </n-tag>
               </n-flex>
            </n-flex>

            <!-- Actions -->
            <n-flex align="center" :wrap="false" style="gap: 12px;">
              <n-select
                size="small"
                :value="adapters.selectedAdapterId"
                :options="adapters.options"
                placeholder="Select adapter"
                clearable
                style="width: 240px"
                @update:value="(v) => adapters.select(v || '')"
              />
              
              <n-button v-if="!ws.connected" size="small" type="primary" @click="connectWs">{{ t('common.connectWs') }}</n-button>
              <n-button v-else size="small" type="error" ghost @click="disconnectWs">{{ t('common.disconnect') }}</n-button>

              <div style="width: 1px; height: 20px; background-color: var(--n-border-color); margin: 0 4px;"></div>

              <n-button size="small" quaternary @click="toggleTheme">
                {{ settings.theme === 'light' ? '🌙' : '☀️' }}
              </n-button>
              
               <n-popover trigger="click" placement="bottom-end">
                <template #trigger>
                  <n-button size="small" strong secondary>
                    {{ t('common.settings') || 'Settings' }}
                  </n-button>
                </template>
                <n-flex vertical style="padding: 8px; min-width: 300px; gap: 12px">
                  <n-text strong depth="1">Connection</n-text>
                  <n-flex align="center" :wrap="false">
                    <n-input
                      v-model:value="baseUrlDraft"
                      placeholder="http://127.0.0.1:3011"
                      style="flex: 1"
                    />
                    <n-button type="primary" ghost @click="applyBaseUrl">{{ t('common.apply') }}</n-button>
                  </n-flex>
                  
                  <n-text strong depth="1" style="margin-top: 4px">Language</n-text>
                  <n-flex align="center" :wrap="false">
                    <n-select
                      v-model:value="localeDraft"
                      :options="[
                        { label: 'English', value: 'en' },
                        { label: 'Русский', value: 'ru' }
                      ]"
                      style="flex: 1"
                    />
                    <n-button @click="applyLocale">{{ t('common.apply') }}</n-button>
                  </n-flex>
                </n-flex>
              </n-popover>
            </n-flex>
          </n-flex>
        </n-layout-header>

        <!-- Level 2: Navigation -->
         <n-layout-header bordered style="height: 48px; padding: 0 16px; z-index: 10;">
            <n-menu
                mode="horizontal"
                :options="menuOptions"
                :value="activeMenuKey"
                @update:value="onMenuSelect"
                style="line-height: 48px;"
            />
        </n-layout-header>

        <n-layout-content
            embedded
            :content-style="{ padding: '24px', backgroundColor: settings.theme === 'dark' ? undefined : '#f5f7fa' }"
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

      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>
