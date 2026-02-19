import NfcClient from 'nfc-jsclient';
import { useAppStore } from '../stores/app';
import { useSettingsStore } from '../stores/settings';

let client: NfcClient | null = null;
let clientKey = '';

export function getSdk(): NfcClient {
    const settings = useSettingsStore();
    const app = useAppStore();

    const key = JSON.stringify({ baseUrl: settings.baseUrl, locale: settings.locale, appKey: app.embeddedAppKey });
    if (client && clientKey === key) return client;

    clientKey = key;

    client = new NfcClient(settings.baseUrl, settings.locale, app.embeddedAppKey);
    return client;
}

export function resetSdk() {
    client = null;
}
