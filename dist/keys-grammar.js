// The keys family's binding grammar, with no DOM: @github/hotkey's, with a letter matching either
// case unless Shift is written and a symbol written as the character typed, Shift ignored.
// Adapted from spike-html-design v0.7.0 (fe75220): modules/keys-grammar.js.
/** Each modifier's name in a binding, to its flag on a press. */
const MODIFIERS = { Control: "control", Alt: "alt", Meta: "meta", Shift: "shift" };
const MODIFIER_NAMES = Object.keys(MODIFIERS);
/** The keys a binding names in words, since "+" and " " separate its parts. */
const NAMED = { plus: "+", space: " " };
// aria-keyshortcuts names physical keys, so a shifted symbol is declared by the US key it is on.
const US_SHIFTED = {
    "~": "`",
    "!": "1",
    "@": "2",
    "#": "3",
    $: "4",
    "%": "5",
    "^": "6",
    "&": "7",
    "*": "8",
    "(": "9",
    ")": "0",
    _: "-",
    "+": "=",
    "{": "[",
    "}": "]",
    "|": "\\",
    ":": ";",
    '"': "'",
    "<": ",",
    ">": ".",
    "?": "/",
};
/** Whether the key is one character. */
const isSingle = (key) => [...key].length === 1;
/** Whether the key is one letter, in any script. */
const isLetter = (key) => isSingle(key) && key.toLowerCase() !== key.toUpperCase();
/** Whether the key is one Latin letter, a to z. */
const isAsciiLetter = (key) => /^[a-z]$/i.test(key);
/** Whether the key is one digit, 0 to 9. */
const isDigit = (key) => /^[0-9]$/.test(key);
/** Whether the key is one character that is no letter, digit, or space. */
const isSymbol = (key) => isSingle(key) && !isLetter(key) && !isDigit(key) && key !== " ";
/** The modifier a name in a binding means, Mod by the platform, or undefined. */
function modifierOf(name, mac) {
    const lower = name.toLowerCase();
    if (lower === "mod")
        return mac ? "Meta" : "Control";
    return MODIFIER_NAMES.find((modifier) => modifier.toLowerCase() === lower);
}
/** The `event.key` a name in a binding means, a letter lowercased, or undefined. */
function keyOf(name) {
    if (isSingle(name))
        return isLetter(name) ? name.toLowerCase() : name;
    return NAMED[name.toLowerCase()] ?? (/^[A-Z][A-Za-z0-9]*$/.test(name) ? name : undefined);
}
/** One combination, such as "Alt+Shift+T", as a press, or why it is malformed. */
function pressOf(token, mac) {
    const parts = token.split("+");
    const name = parts.pop() ?? "";
    const press = { key: "", control: false, alt: false, meta: false, shift: false };
    for (const part of parts) {
        if (part === "")
            return `"${token}" has an empty key around a "+"; write the + key as Plus`;
        const modifier = modifierOf(part, mac);
        if (!modifier)
            return `"${token}" joins "${part}", which is not a modifier, to another key`;
        if (press[MODIFIERS[modifier]])
            return `"${token}" repeats ${modifier}`;
        press[MODIFIERS[modifier]] = true;
    }
    if (name === "")
        return `"${token}" ends in "+" with no key; write the + key as Plus`;
    if (modifierOf(name, mac))
        return `"${token}" is a modifier with no key`;
    const key = keyOf(name);
    if (key === undefined) {
        return `"${token}" names no key; a named key is spelled as its event.key, as Escape`;
    }
    press.key = key;
    if (isSymbol(key))
        press.shift = false;
    return press;
}
/** A binding's alternatives, or why it is malformed. */
function parsed(binding, mac) {
    if (typeof binding !== "string")
        return "a binding must be a string";
    const alternatives = [];
    for (const alternative of binding.split(",")) {
        const tokens = alternative.trim().split(/\s+/);
        if (tokens[0] === "")
            return `"${binding}" has an empty alternative`;
        const sequence = [];
        for (const token of tokens) {
            const press = pressOf(token, mac);
            if (typeof press === "string")
                return press;
            sequence.push(press);
        }
        alternatives.push(sequence);
    }
    return alternatives;
}
/** The parsed binding, or null when it is malformed; any value is accepted. */
export function parse(binding, { mac = false } = {}) {
    const result = parsed(binding, mac);
    return typeof result === "string" ? null : result;
}
/** Why the binding is malformed, or null when it parses. */
export function problem(binding) {
    const result = parsed(binding, false);
    return typeof result === "string" ? result : null;
}
/** The press's modifiers, in normal order. */
const modifiersOf = (press) => MODIFIER_NAMES.filter((modifier) => press[MODIFIERS[modifier]]);
/** The press's key as its normal string writes it. */
function keyName({ key, shift }) {
    if (key === "+")
        return "Plus";
    if (key === " ")
        return "Space";
    return isLetter(key) && shift ? key.toUpperCase() : key;
}
/** A binding, sequence, or press as its normal string. */
export function stringify(value) {
    if (!Array.isArray(value))
        return [...modifiersOf(value), keyName(value)].join("+");
    if (value.length > 0 && !Array.isArray(value[0])) {
        return value.map((press) => stringify(press)).join(" ");
    }
    return value.map((sequence) => stringify(sequence)).join(", ");
}
/** The binding's normal string, or null when it is malformed. */
export function normalize(binding, options) {
    const result = parse(binding, options);
    return result && stringify(result);
}
/** Whether a keydown is the press. */
export function matches(press, event) {
    if (!!event.ctrlKey !== press.control || !!event.altKey !== press.alt)
        return false;
    if (!!event.metaKey !== press.meta)
        return false;
    if (isSymbol(press.key))
        return event.key === press.key;
    if (!!event.shiftKey !== press.shift)
        return false;
    if (isAsciiLetter(press.key)) {
        // Option and AltGr change the character, and a non-Latin layout types another letter on the
        // same key, so these compare by the physical key.
        if (event.altKey || (isLetter(event.key) && !isAsciiLetter(event.key))) {
            return event.code === `Key${press.key.toUpperCase()}`;
        }
        return event.key.toLowerCase() === press.key;
    }
    if (isDigit(press.key) && event.altKey)
        return event.code === `Digit${press.key}`;
    if (isLetter(press.key))
        return event.key.toLowerCase() === press.key;
    return event.key === press.key;
}
/** A key as the help dialog shows it: a letter uppercased, and Space by name. */
function label(key) {
    if (key === " ")
        return "Space";
    return isLetter(key) ? key.toUpperCase() : key;
}
/** A sequence for display: each press as its modifiers' names, then its key's label. */
export function labels(sequence) {
    return sequence.map((press) => [...modifiersOf(press), label(press.key)]);
}
/** The binding's aria-keyshortcuts: its single-press alternatives, or null for none. */
export function keyshortcuts(binding) {
    const declared = binding
        .filter((sequence) => sequence.length === 1)
        .map(([press]) => {
        const physical = US_SHIFTED[press.key];
        const shown = { ...press, key: physical ?? press.key, shift: press.shift || !!physical };
        return [...modifiersOf(shown), label(shown.key)].join("+");
    });
    return declared.length > 0 ? [...new Set(declared)].join(" ") : null;
}
