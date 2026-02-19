import { defineStore } from 'pinia';
import type { Event } from 'nfc-jsclient/dist/client/events';

import { getSdk } from '../services/sdk';

export const useWsStore = defineStore('ws', {
    state: () => ({
        connected: false,
        lastError: '' as string,
        lastEvent: null as Event | null,
        handlersInitialized: false,
    }),

    actions: {
        initHandlers() {
            if (this.handlersInitialized) return;
            const sdk = getSdk();

            sdk.Ws.onEvent(e => {
                this.lastEvent = e;
            });

            sdk.Ws.onError(err => {
                this.lastError = err instanceof Error ? err.message : String(err);
            });

            this.handlersInitialized = true;
        },

        connect() {
            const sdk = getSdk();
            this.lastError = '';
            this.initHandlers();
            sdk.Ws.connect();
            this.connected = sdk.Ws.isConnected();
        },

        disconnect() {
            const sdk = getSdk();
            sdk.Ws.disconnect();
            this.connected = false;
        },

        syncConnected() {
            const sdk = getSdk();
            this.connected = sdk.Ws.isConnected();
        },
    },
});
