/** A facet a profile belongs to. */
export type Facet = "color" | "space" | "type";
/** The store, public API: each facet's names. An older copy's store may lack a newer facet. */
export type Store = Partial<Record<Facet, string[]>>;
/** The facets; the scheme is not one. */
export declare const FACETS: readonly Facet[];
/** Each facet's default profile: the one both CSS entries apply with no attribute. */
export declare const DEFAULTS: Readonly<Record<Facet, string>>;
/** Lists a profile's name under its facet, once; it keeps its first place. */
export declare function register(facet: Facet, name: string): void;
/** A copy of the facet's names, in registration order. */
export declare function profiles(facet: Facet): string[];
