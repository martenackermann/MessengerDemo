// src/services/fingerprint.ts

// Generates a stable SHA-256 fingerprint from a public key.
// Users compare these fingerprints manually to verify identity.

export async function generateFingerprint(
    publicKeyBase64: string
): Promise<string> {

    const encoder = new TextEncoder();

    const data = encoder.encode(publicKeyBase64);

    const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        data
    );

    const hashBytes = Array.from(
        new Uint8Array(hashBuffer)
    );

    // Format:
    // XXXX XXXX XXXX XXXX ...
    // Similar to Signal-style safety numbers.

    return hashBytes
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .match(/.{1,4}/g)!
        .join(" ")
        .toUpperCase();
}