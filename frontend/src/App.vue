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
  NMenu,
  NMessageProvider,
  NText,
} from 'naive-ui';
import { useRoute, useRouter } from 'vue-router';

import { useAppStore } from './stores/app';
import { useSettingsStore } from './stores/settings';

const router = useRouter();
const route = useRoute();

const app = useAppStore();
const settings = useSettingsStore();

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
}

onMounted(async () => {
  await app.loadEmbeddedAppKey();
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
              <n-text depth="3">
                App key: {{ appKeyStatus }}
              </n-text>
            </n-flex>
          </n-flex>
        </n-layout-header>

        <n-layout-content style="padding: 16px">
          <router-view />
        </n-layout-content>
      </n-layout>
    </n-message-provider>
  </n-config-provider>
</template>
