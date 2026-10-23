import type { Sequence } from "./keys-grammar.ts";
/** A register() binding's handler, given the keys-fire event. */
type Handler = (event: CustomEvent<FireDetail>) => void;
/** A `register` binding, as the store holds it. */
export interface Registered {
    keys: string;
    label: string;
    handler: Handler;
}
/** The store, public API: the registered bindings, the default wait in ms, and the listener flag. */
export interface Store {
    registered: Registered[];
    wait: number;
    listening: boolean;
}
/** The reader's settings in effect. */
export interface Settings {
    enabled: boolean;
    wait: number;
}
/** A change to the reader's settings; null removes a setting. */
export type SettingsChange = {
    [name in keyof Settings]?: Settings[name] | null;
};
/** keys-fire's detail: the binding's normal string, the presses that fired it, and its label. */
export interface FireDetail {
    binding: string | null;
    keys: string[];
    label?: string;
}
/** keys-sequence's detail: the sequence's state, its presses so far, and why it ended. */
export interface SequenceDetail {
    state: "start" | "continue" | "end";
    presses: string[];
    reason?: "fired" | "timeout" | "dropped";
}
/** A binding the help dialog lists, with `run` to act as a press would. */
export interface Listed {
    keys: string;
    label: string | null;
    element: HTMLElement | null;
    sequences: Sequence[];
    off: boolean;
    run: () => void;
}
/** Binds keys to a handler with no element; returns a function that removes this binding. */
export declare function register(keys: string, label: string, handler: Handler): () => void;
/** The waits between presses, in ms, a reader can pick. */
export declare const WAITS: readonly [1000, 1500, 3000, 5000];
/** The settings in effect: the reader's where stored and valid, else the defaults. */
export declare function settings(): Settings;
/** Stores the reader's change, a default or null removing a setting, and returns the settings. */
export declare function changeSettings(change: SettingsChange): Settings;
/** The bindings active were the dialog closed, each sequence listed once under the one it fires. */
export declare function bindings(dialog: Element | null): Listed[];
export {};
