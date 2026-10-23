// The page's keyboard shortcuts: an element with data-keys is clicked or focused by its keys, and
// register() binds a handler. One store at a well-known global key is shared by every copy, and
// the first copy to load installs the one listener, so a key never fires twice.
// Adapted from spike-html-design v0.7.0 (fe75220): modules/keys.js.
import { keyshortcuts, matches, normalize, parse, problem, stringify } from "./keys-grammar.js";
/** The store's well-known global key, shared by every copy of the module. */
const KEY = Symbol.for("spike-html-design.keys");
const scope = globalThis;
scope[KEY] ??= { registered: [], wait: 1500, listening: false };
const store = scope[KEY];
// userAgentData is Chromium's and not yet in TypeScript's DOM types.
const agent = navigator;
const mac = /mac|iphone|ipad/i.test(agent.userAgentData?.platform ?? navigator.platform);
/** The keys that only modify another, which neither start nor drop a sequence. */
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock", "OS"]);
/** Binds keys to a handler with no element; returns a function that removes this binding. */
export function register(keys, label, handler) {
    const reason = problem(keys);
    if (reason)
        throw new TypeError(`keys: ${reason}`);
    if (typeof label !== "string")
        throw new TypeError("keys: a binding's label must be a string");
    if (typeof handler !== "function") {
        throw new TypeError("keys: a binding's handler must be a function");
    }
    const entry = { keys, label, handler };
    store.registered.push(entry);
    return () => {
        const index = store.registered.indexOf(entry);
        if (index !== -1)
            store.registered.splice(index, 1);
    };
}
/** The waits between presses, in ms, a reader can pick. */
export const WAITS = [1000, 1500, 3000, 5000];
/** The localStorage key of the reader's settings. */
const STORAGE = "spike-html-design.keys";
/** Each setting's check: the values a reader can choose. */
const VALID = {
    enabled: (value) => typeof value === "boolean",
    wait: (value) => WAITS.some((ms) => ms === value),
};
/** Whether the name is a setting. */
const isSetting = (name) => name in VALID;
/** The settings with nothing stored: on, at the store's wait. */
const defaults = () => ({ enabled: true, wait: store.wait });
/** The reader's valid stored settings; none when storage is empty, unparseable, or blocked. */
function stored() {
    let saved;
    try {
        saved = JSON.parse(localStorage.getItem(STORAGE) ?? "null");
    }
    catch {
        return {};
    }
    if (!saved || typeof saved !== "object")
        return {};
    const values = saved;
    return Object.fromEntries(Object.keys(VALID)
        .filter((name) => isSetting(name) && VALID[name](values[name]))
        .map((name) => [name, values[name]]));
}
/** The settings in effect: the reader's where stored and valid, else the defaults. */
export function settings() {
    return { ...defaults(), ...stored() };
}
/** Stores the reader's change, a default or null removing a setting, and returns the settings. */
export function changeSettings(change) {
    const next = stored();
    const fallback = defaults();
    for (const [name, value] of Object.entries(change)) {
        if (!isSetting(name))
            throw new TypeError(`keys: "${name}" is not a setting`);
        if (value !== null && !VALID[name](value)) {
            throw new TypeError(`keys: ${JSON.stringify(value)} is not a ${name} the reader can choose`);
        }
        if (value === null || value === fallback[name])
            delete next[name];
        else
            next[name] = value;
    }
    try {
        if (Object.keys(next).length === 0)
            localStorage.removeItem(STORAGE);
        else
            localStorage.setItem(STORAGE, JSON.stringify(next));
    }
    catch {
        // Storage is blocked: the change is lost.
    }
    declare();
    return settings();
}
// The off switch covers character keys alone, never a combination with Control, Alt, or Meta
// (WCAG 2.1.4).
const isCharacter = (press) => !press.control && !press.alt && !press.meta && [...press.key].length === 1;
/** The binding's alternatives the settings leave active, or null when it is malformed. */
function effective(binding, current) {
    const alternatives = parse(binding, { mac });
    if (!alternatives || current.enabled)
        return alternatives;
    return alternatives.filter((sequence) => !sequence.every(isCharacter));
}
/** Writes aria-keyshortcuts on every data-keys element, removing it where nothing is declared. */
function declare() {
    const current = settings();
    for (const el of document.querySelectorAll("[data-keys]")) {
        const alternatives = effective(el.getAttribute("data-keys"), current);
        const value = alternatives && keyshortcuts(alternatives);
        if (!value)
            el.removeAttribute("aria-keyshortcuts");
        else if (el.getAttribute("aria-keyshortcuts") !== value) {
            el.setAttribute("aria-keyshortcuts", value);
        }
    }
}
/** Whether the target is a form field or editable, where a key types. */
function isField(el) {
    return (el instanceof HTMLElement &&
        (el.isContentEditable || el.closest("input, textarea, select") !== null));
}
const warned = new WeakMap();
/** The element's binding, or null after warning once per element and value. */
function elementBinding(el, current) {
    const keys = el.getAttribute("data-keys");
    const alternatives = effective(keys, current);
    if (alternatives)
        return { el, keys: keys ?? "", alternatives };
    const seen = warned.get(el) ?? new Set();
    if (!seen.has(keys)) {
        console.warn(`keys: data-keys binds nothing: ${problem(keys)}`, el);
        warned.set(el, seen.add(keys));
    }
    return null;
}
/** Whether the element can act: enabled, not inert, and rendered. */
const isActiveElement = (el) => !el.matches(":disabled") && !el.closest("[inert]") && el.checkVisibility();
/**
 * The active bindings, first-wins order: elements in document order, then registered ones. An
 * open modal narrows them to its elements; `closed` is a dialog treated as closed.
 */
function active(current, closed = null) {
    const modal = [...document.querySelectorAll(":modal")].find((el) => el !== closed);
    const elements = [...document.querySelectorAll("[data-keys]")]
        .filter((el) => (!modal || modal.contains(el)) && !closed?.contains(el) && isActiveElement(el))
        .map((el) => elementBinding(el, current))
        .filter((binding) => binding !== null);
    if (modal)
        return elements;
    const registered = store.registered.map((entry) => ({
        entry,
        keys: entry.keys,
        alternatives: effective(entry.keys, current) ?? [],
    }));
    return [...elements, ...registered];
}
let pending = null;
// An event's fields are live only while it dispatches, so a pending press keeps a copy.
const snapshot = ({ key, code, shiftKey, altKey, ctrlKey, metaKey }) => ({
    key,
    code,
    shiftKey,
    altKey,
    ctrlKey,
    metaKey,
});
// keyCode 229 is a press an input method takes, where isComposing isn't yet set.
const passed = (event) => event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229;
/** Whether the press is one keys never matches. */
const silent = (event) => passed(event) ||
    event.key === "Dead" ||
    event.key === "Process" ||
    MODIFIER_KEYS.has(event.key) ||
    event.getModifierState?.("AltGraph") ||
    isField(event.target);
/** Blurs the field an Escape was pressed in, outside any modal, and reports whether it did. */
function release(event) {
    const field = document.activeElement;
    if (event.key !== "Escape" || passed(event) || field !== event.target)
        return false;
    if (!isField(field) || document.querySelector(":modal"))
        return false;
    field.blur();
    return true;
}
/** Dispatches keys-sequence on the document. */
function announce(state, presses, reason) {
    const detail = { state, presses: [...presses], ...(reason && { reason }) };
    document.dispatchEvent(new CustomEvent("keys-sequence", { detail }));
}
/** Ends the pending sequence; it ends before the binding acts, so a throw leaves none behind. */
function end(reason) {
    if (!pending)
        return;
    clearTimeout(pending.timer);
    const { strings } = pending;
    pending = null;
    announce("end", strings, reason);
}
/** The binding's keys-fire event, for the presses that fired it. */
function fireEvent(binding, sequence) {
    const detail = {
        binding: normalize(binding.keys, { mac }),
        keys: sequence.map((press) => stringify(press)),
    };
    if (binding.entry)
        detail.label = binding.entry.label;
    return new CustomEvent("keys-fire", { bubbles: true, cancelable: true, detail });
}
/** Runs the binding: its handler, else focuses its field or clicks its element. */
function act(binding, event) {
    if (binding.entry)
        binding.entry.handler(event);
    else if (isField(binding.el))
        binding.el.focus();
    else
        binding.el.click();
}
/** Dispatches keys-fire and, unless it is cancelled, acts. */
function fire({ binding, sequence }) {
    const event = fireEvent(binding, sequence);
    if ((binding.el ?? document).dispatchEvent(event))
        act(binding, event);
}
/** The bindings active were the dialog closed, each sequence listed once under the one it fires. */
export function bindings(dialog) {
    const current = settings();
    const seen = new Set();
    const listed = [];
    for (const binding of active({ ...current, enabled: true }, dialog)) {
        const sequences = binding.alternatives.filter((sequence) => {
            const key = stringify(sequence);
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
        if (sequences.length === 0)
            continue;
        listed.push({
            keys: binding.keys,
            label: binding.entry?.label ?? null,
            element: binding.el ?? null,
            sequences,
            off: !current.enabled && sequences.every((sequence) => sequence.every(isCharacter)),
            run: () => act(binding, fireEvent(binding, [])),
        });
    }
    return listed;
}
let help = null;
let loading = null;
/** Imports keys-help.ts once, resolving to it, or to null after a failure the next call retries. */
function loadHelp() {
    loading ??= import("./keys-help.js").then((module) => (help = module), (error) => {
        // Forgotten, so the next open retries, and the browser requests the module again.
        loading = null;
        console.warn("keys: the help module failed to load", error);
        return null;
    });
    return loading;
}
/** Fills a help dialog as it opens, loading keys-help.ts on the first open. */
function onbeforetoggle(event) {
    const dialog = event.target;
    if (event.newState !== "open" || !(dialog instanceof HTMLDialogElement))
        return;
    if (!dialog.querySelector("[data-keys-list]"))
        return;
    if (help)
        help.fill(dialog);
    else
        loadHelp().then((module) => module?.fill(dialog));
}
/** Matches a press, after those pending, and fires, waits for a longer binding, or drops. */
function onkey(event) {
    if (release(event) || silent(event))
        return;
    const presses = [...(pending?.presses ?? []), snapshot(event)];
    const n = presses.length;
    const current = settings();
    let complete = null;
    let longer = null;
    for (const binding of active(current)) {
        for (const sequence of binding.alternatives) {
            if (sequence.length < n || !presses.every((press, i) => matches(sequence[i], press))) {
                continue;
            }
            if (sequence.length === n)
                complete ??= { binding, sequence };
            else
                longer ??= { binding, sequence };
        }
    }
    const matched = complete ?? longer;
    if (!matched) {
        if (pending)
            end("dropped");
        return;
    }
    event.preventDefault();
    const strings = matched.sequence.slice(0, n).map((press) => stringify(press));
    if (!longer) {
        if (pending) {
            pending.strings = strings;
            end("fired");
        }
        fire(matched);
        return;
    }
    const started = !pending;
    if (pending)
        clearTimeout(pending.timer);
    const next = { presses, strings, complete, timer: 0 };
    pending = next;
    next.timer = setTimeout(() => {
        end(next.complete ? "fired" : "timeout");
        if (next.complete)
            fire(next.complete);
    }, current.wait);
    announce(started ? "start" : "continue", strings);
}
/** Keeps aria-keyshortcuts current as data-keys elements and the stored settings change. */
function observe() {
    declare();
    addEventListener("storage", (event) => {
        if (event.key === STORAGE || event.key === null)
            declare();
    });
    new MutationObserver((records) => {
        for (const { target, attributeName, oldValue } of records) {
            const element = target;
            if (attributeName === "data-keys" &&
                oldValue !== null &&
                !element.hasAttribute("data-keys")) {
                element.removeAttribute("aria-keyshortcuts");
            }
        }
        declare();
    }).observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ["data-keys"],
    });
}
if (!store.listening) {
    store.listening = true;
    document.addEventListener("keydown", onkey);
    // beforetoggle doesn't bubble.
    document.addEventListener("beforetoggle", onbeforetoggle, true);
    observe();
}
