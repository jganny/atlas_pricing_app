/** Firestore `setDoc` rejects `undefined` anywhere in the payload (nested objects/arrays too). */
export function omitUndefinedDeep(value) {
    if (value === undefined)
        return value;
    if (value === null || typeof value !== "object")
        return value;
    if (value instanceof Date)
        return value;
    if (Array.isArray(value)) {
        return value
            .filter((item) => item !== undefined)
            .map((item) => omitUndefinedDeep(item));
    }
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
        if (nested === undefined)
            continue;
        out[key] = omitUndefinedDeep(nested);
    }
    return out;
}
