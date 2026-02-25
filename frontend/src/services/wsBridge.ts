import { watch } from 'vue';

import { useRunsStore } from '../stores/runs';
import { useWsStore } from '../stores/ws';
import { useJobModalStore } from '../stores/jobModal';
import { useAdaptersStore } from '../stores/adapters';
import { useAboutStore } from '../stores/about';
import { useLicenseStore } from '../stores/license';

let started = false;

export function startWsBridge() {
    if (started) return;
    started = true;

    const ws = useWsStore();
    const runs = useRunsStore();
    const jobModal = useJobModalStore();

    watch(
        () => ws.lastEvent,
        ev => {
            if (!ev) return;
            runs.ingestWsEvent(ev);
            jobModal.ingestWsEvent(ev);
        },
        { deep: false },
    );

    const adapters = useAdaptersStore();
    const about = useAboutStore();
    const license = useLicenseStore();

    watch(
        () => ws.connected,
        isConnected => {
            if (!isConnected) {
                adapters.list = [];
                jobModal.close('auto');
            } else {
                void Promise.all([
                    about.refresh(),
                    license.refreshAccess(),
                    adapters.refresh()
                ]);
            }
        },
        { deep: false },
    );
}
