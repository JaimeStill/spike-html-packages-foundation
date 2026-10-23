/** One press: the `event.key` it matches, and whether each modifier is held. */
export interface Press {
    key: string;
    control: boolean;
    alt: boolean;
    meta: boolean;
    shift: boolean;
}
/** The presses of one alternative, in order. */
export type Sequence = Press[];
/** A parsed binding: its alternatives. */
export type Binding = Sequence[];
/** The fields of a keydown that `matches` reads. */
export interface KeyLike {
    key: string;
    code: string;
    shiftKey: boolean;
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
}
/** Parsing options: `mac` resolves Mod to Meta, else to Control. */
export interface ParseOptions {
    mac?: boolean;
}
/** The parsed binding, or null when it is malformed; any value is accepted. */
export declare function parse(binding: unknown, { mac }?: ParseOptions): Binding | null;
/** Why the binding is malformed, or null when it parses. */
export declare function problem(binding: unknown): string | null;
/** A binding, sequence, or press as its normal string. */
export declare function stringify(value: Binding | Sequence | Press): string;
/** The binding's normal string, or null when it is malformed. */
export declare function normalize(binding: unknown, options?: ParseOptions): string | null;
/** Whether a keydown is the press. */
export declare function matches(press: Press, event: KeyLike): boolean;
/** A sequence for display: each press as its modifiers' names, then its key's label. */
export declare function labels(sequence: Sequence): string[][];
/** The binding's aria-keyshortcuts: its single-press alternatives, or null for none. */
export declare function keyshortcuts(binding: Binding): string | null;
