// src/stores/truststore.ts

// Stores trusted fingerprints locally.
// This enables manual identity verification.
//
// Example:
//
// Alice verifies Bob's fingerprint once.
// Future key changes trigger warnings.

const STORAGE_KEY = "chat:trusted-fingerprints";

export interface TrustedFingerprint {
    userId: string;
    fingerprint: string;
    verifiedAt: string;
}

function loadTrustedFingerprints(): TrustedFingerprint[] {

    try {

        return JSON.parse(
            localStorage.getItem(STORAGE_KEY) ?? "[]"
        );

    } catch {

        return [];

    }

}

function saveTrustedFingerprints(
    items: TrustedFingerprint[]
) {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(items)
    );

}

// Mark a fingerprint as trusted.

export function trustFingerprint(
    userId: string,
    fingerprint: string
) {

    const existing = loadTrustedFingerprints()
        .filter((x) => x.userId !== userId);

    existing.push({
        userId,
        fingerprint,
        verifiedAt: new Date().toISOString(),
    });

    saveTrustedFingerprints(existing);

}

// Retrieve trusted fingerprint for a user.

export function getTrustedFingerprint(
    userId: string
): TrustedFingerprint | null {

    return (
        loadTrustedFingerprints()
            .find((x) => x.userId === userId)
        ?? null
    );

}

// Check whether fingerprint matches trusted value.

export function isFingerprintTrusted(
    userId: string,
    fingerprint: string
): boolean {

    const trusted = getTrustedFingerprint(userId);

    if (!trusted) {
        return false;
    }

    return trusted.fingerprint === fingerprint;

}

// Remove trust relationship.

export function removeTrustedFingerprint(
    userId: string
) {

    const filtered =
        loadTrustedFingerprints()
            .filter((x) => x.userId !== userId);

    saveTrustedFingerprints(filtered);

}