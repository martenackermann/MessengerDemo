import { describe, it, expect, beforeEach } from 'vitest';
import { 
    generateRoomKey, 
    encryptMessage, 
    decryptMessage 
} from '../services/e2ee.ts';

describe('Crypto Tests', () => {
    let roomKey: CryptoKey;

    beforeEach(async () => {
        roomKey = await generateRoomKey();
    });

    it('encrypt: decrypt returns the original message', async () => {
        const originalMessage = "Hello, Secure World!";
        
        // Encrypt
        const encrypted = await encryptMessage(roomKey, originalMessage);
        
        // Decrypt
        const decrypted = await decryptMessage(roomKey, encrypted);
        
        expect(decrypted).toBe(originalMessage);
    });

    it('decrypt: qchanged messages must fail to decrypt or verify', async () => {
        const originalMessage = "Important secret message";
        
        // Encrypt
        const payload = await encryptMessage(roomKey, originalMessage);
        
        // Modify the encrypted data (tamper with the ciphertext)
        const tamperedPayload = {
            ...payload,
            data: [...payload.data]
        };
        
        // Flip a bit in the data
        tamperedPayload.data[0] = tamperedPayload.data[0] ^ 0x01;

        // AES-GCM should throw an error on decryption if data is tampered with
        await expect(decryptMessage(roomKey, tamperedPayload))
            .rejects
            .toThrow();
    });
});
