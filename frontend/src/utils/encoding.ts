export function cleanHex(input: string): string {
    return input
        .trim()
        .toLowerCase()
        .replace(/^0x/, '')
        .replace(/[^0-9a-f]/g, '');
}

export function hexToBytes(hex: string): Uint8Array {
    const cleaned = cleanHex(hex);
    if (cleaned.length === 0) return new Uint8Array();
    if (cleaned.length % 2 !== 0) {
        throw new Error('Invalid HEX: odd number of digits');
    }

    const bytes = new Uint8Array(cleaned.length / 2);
    for (let i = 0; i < cleaned.length; i += 2) {
        bytes[i / 2] = parseInt(cleaned.slice(i, i + 2), 16);
    }
    return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ')
        .toUpperCase();
}

export function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach(b => {
        binary += String.fromCharCode(b);
    });
    return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export function hexToBase64(hex: string): string {
    return bytesToBase64(hexToBytes(hex));
}

export function base64ToHex(base64: string): string {
    return bytesToHex(base64ToBytes(base64));
}

export function base64ToAscii(base64: string): string {
    return atob(base64);
}
