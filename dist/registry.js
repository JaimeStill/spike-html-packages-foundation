// The page's registry of the profiles it can apply, per facet, in one store at a well-known global
// key, so every copy of this module, from any URL or tag, registers into the same lists.
// Adapted from spike-html-design v0.7.0 (fe75220): modules/registry.js.
/** The facets; the scheme is not one. */
export const FACETS = Object.freeze(["color", "space", "type"]);
/** Each facet's default profile: the one both CSS entries apply with no attribute. */
export const DEFAULTS = Object.freeze({
    color: "flexoki",
    space: "regular",
    type: "mono",
});
/** The store's well-known global key, shared by every copy of the module. */
const KEY = Symbol.for("spike-html-design.registry");
const scope = globalThis;
scope[KEY] ??= { color: [], space: [], type: [] };
const store = scope[KEY];
/** The facet, or a TypeError naming it; it guards callers the types never reach, as plain script. */
function facetOf(facet) {
    if (!FACETS.includes(facet)) {
        throw new TypeError(`registry: unknown facet ${facet}; expected one of ${FACETS.join(", ")}`);
    }
    return facet;
}
/** Lists a profile's name under its facet, once; it keeps its first place. */
export function register(facet, name) {
    facetOf(facet);
    if (typeof name !== "string" || name === "") {
        throw new TypeError(`registry: a ${facet} profile's name must be a non-empty string`);
    }
    const names = (store[facet] ??= []);
    if (!names.includes(name))
        names.push(name);
}
/** A copy of the facet's names, in registration order. */
export function profiles(facet) {
    return [...(store[facetOf(facet)] ?? [])];
}
