import NfcClient from 'nfc-jsclient';
import { useAppStore } from '../stores/app';
import { useSettingsStore } from '../stores/settings';

let client: NfcClient | null = null;

export function getSdk(): NfcClient {
    if (client) return client;

    const settings = useSettingsStore();
    const app = useAppStore();

    client = new NfcClient(settings.baseUrl, settings.locale, app.embeddedAppKey);
    return client;
}

export function resetSdk() {
    client = null;
}
