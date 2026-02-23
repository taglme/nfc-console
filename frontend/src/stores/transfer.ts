import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useTransferStore = defineStore('transfer', () => {
    const ndefRecords = ref<any[] | null>(null);

    function takeRecords() {
        const records = ndefRecords.value;
        ndefRecords.value = null;
        return records;
    }

    return { ndefRecords, takeRecords };
});
