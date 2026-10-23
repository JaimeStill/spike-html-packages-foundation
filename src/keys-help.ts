// The keys help dialog's contents: the bindings table, the reader's settings, and a screen-reader
// note, filled into each [data-keys-list] of a dialog as it opens. keys.ts loads it lazily.
// Adapted from spike-html-design v0.7.0 (fe75220): modules/keys-help.js.

import { bindings, changeSettings, settings, WAITS } from "./keys.ts";
import type { Listed } from "./keys.ts";
import { labels } from "./keys-grammar.ts";
import type { Sequence } from "./keys-grammar.ts";

/** The screen-reader note the dialog carries. */
const NOTE =
  "Screen readers: a screen reader may take a key before the page does. To pass the next key " +
  "through, press NVDA+F2 in NVDA, JAWS+3 in JAWS, Narrator+3 in Narrator, or VO+Tab in VoiceOver.";

/** Each row button's binding action. */
const runs = new WeakMap<Element, () => void>();
/** The dialog each list's listeners were added for. */
const wired = new WeakMap<Element, HTMLDialogElement>();

/** A new element of the tag, with the text when given. */
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  return el;
}

/** The element's text without its key hints: each kbd, and the joiner between two of them. */
function textOf(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  for (const kbd of copy.querySelectorAll("kbd")) {
    const joiner = kbd.nextSibling;
    const after = joiner?.nextSibling;
    if (
      joiner?.nodeType === Node.TEXT_NODE &&
      after instanceof Element &&
      after.localName === "kbd"
    ) {
      joiner.remove();
    }
    kbd.remove();
  }
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** A row's action label: aria-label, else its text, else its field's label, else its keys. */
function labelOf({ element, label, keys }: Listed): string {
  if (!element) return label ?? "";
  const aria = element.getAttribute("aria-label")?.trim();
  if (aria) return aria;
  const text = textOf(element);
  if (text) return text;
  const field = (element as Partial<Pick<HTMLInputElement, "labels">>).labels?.[0];
  return (field && textOf(field)) || keys;
}

/** A binding's sequences as kbd elements, joined by "+", " then ", and " or ". */
function keysOf(sequences: Sequence[]): (string | Node)[] {
  const nodes: (string | Node)[] = [];
  sequences.forEach((sequence, a) => {
    if (a > 0) nodes.push(" or ");
    labels(sequence).forEach((press, p) => {
      if (p > 0) nodes.push(" then ");
      press.forEach((name, k) => {
        if (k > 0) nodes.push("+");
        nodes.push(element("kbd", name));
      });
    });
  });
  return nodes;
}

/** A table row of the keys cell and the action cell. */
function row(keys: Node, action: Node): HTMLTableRowElement {
  const tr = element("tr");
  const cells = [keys, action].map((content) => {
    const td = element("td");
    td.append(content);
    return td;
  });
  tr.append(...cells);
  return tr;
}

/** A binding's row: its keys, marked off when off, and a button that runs it. */
function bindingRow(binding: Listed): HTMLTableRowElement {
  const keys = new DocumentFragment();
  keys.append(...keysOf(binding.sequences));
  if (binding.off) keys.append(element("small", " off"));
  const button = element("button", labelOf(binding));
  button.type = "button";
  runs.set(button, binding.run);
  const tr = row(keys, button);
  if (binding.off) tr.dataset.keysOff = "";
  return tr;
}

/** Escape's fixed row: releasing a field is no binding, so it is never off and runs nothing. */
function escapeRow(): HTMLTableRowElement {
  const tr = row(element("kbd", "Esc"), new Text("Leave a field"));
  tr.dataset.keysFixed = "";
  return tr;
}

/** The bindings table, each active binding's row and then Escape's. */
function table(dialog: HTMLDialogElement): HTMLTableElement {
  const el = element("table");
  el.dataset.keysTable = "";
  el.innerHTML = `<thead><tr><th scope="col">Keys</th><th scope="col">Action</th></tr></thead><tbody></tbody>`;
  el.tBodies[0].append(...bindings(dialog).map(bindingRow), escapeRow());
  return el;
}

/** The wait select; a store.wait the reader can't pick shows as an option that clears theirs. */
function waitControl(wait: number): HTMLLabelElement {
  const label = element("label");
  const select = element("select");
  select.name = "wait";
  const shown = (ms: number) => `${ms / 1000} s`;
  if (!WAITS.some((ms) => ms === wait)) select.append(new Option(shown(wait), "", false, true));
  for (const ms of WAITS) select.append(new Option(shown(ms), String(ms), false, ms === wait));
  label.append("Wait between presses ", select);
  return label;
}

/** The settings fieldset: the character-key switch and the wait. */
function form(): HTMLFieldSetElement {
  const current = settings();
  const fieldset = element("fieldset");
  fieldset.dataset.keysSettings = "";
  const enabled = element("input");
  Object.assign(enabled, { type: "checkbox", name: "enabled", checked: current.enabled });
  const on = element("label");
  on.append(enabled, " Character-key shortcuts (combinations with Control, Alt, or Meta stay on)");
  const p = element("p");
  p.append(waitControl(current.wait));
  fieldset.append(element("legend", "Settings"), on, p);
  return fieldset;
}

/** Replaces the list's bindings table with a current one. */
function render(list: Element, dialog: HTMLDialogElement): void {
  list.querySelector(":scope > [data-keys-table]")?.remove();
  list.prepend(table(dialog));
}

/** Adds the list's click and change listeners, once per list and dialog. */
function wire(list: Element, dialog: HTMLDialogElement): void {
  if (wired.get(list) === dialog) return;
  wired.set(list, dialog);
  list.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button") : null;
    const run = button && runs.get(button);
    if (!run) return;
    dialog.close();
    run();
  });
  list.addEventListener("change", (event) => {
    const { name, type, checked, value } = event.target as HTMLInputElement;
    if (!name) return;
    const setting = type === "checkbox" ? checked : value === "" ? null : Number(value);
    changeSettings({ [name]: setting });
    render(list, dialog);
  });
}

/** Fills each [data-keys-list] in the dialog; keys.ts calls it at each open. */
export function fill(dialog: HTMLDialogElement): void {
  for (const list of dialog.querySelectorAll("[data-keys-list]")) {
    wire(list, dialog);
    const note = element("p", NOTE);
    note.dataset.keysNote = "";
    list.replaceChildren(form(), note);
    render(list, dialog);
  }
}
