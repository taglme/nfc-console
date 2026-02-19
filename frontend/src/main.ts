import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import { router } from './router';
import { i18n } from './i18n';
import './style.css';
import { useSettingsStore } from './stores/settings';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);

// Sync initial locale from persisted settings
const settings = useSettingsStore();
i18n.global.locale.value = settings.locale;

app.mount('#app');
