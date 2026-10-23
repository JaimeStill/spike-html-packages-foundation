// The foundation's DOM helpers: the platform alone, no package and no other layer.
// From spike-html-conventions (a88828a): layers/foundation/dom.ts.

/** Defines a custom element once, so a second import of its module is harmless. */
export function define(tag: string, element: CustomElementConstructor): void {
  if (!customElements.get(tag)) {
    customElements.define(tag, element);
  }
}

/** Dispatches a bubbling, composed `CustomEvent`, the way an element reports out. */
export function emit<T>(target: EventTarget, type: string, detail: T): boolean {
  return target.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
}

/** The first element matching `selector`, or an error naming it. */
export function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`no element matches ${selector}`);
  }
  return element;
}
