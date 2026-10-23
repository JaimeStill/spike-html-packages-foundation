/** Defines a custom element once, so a second import of its module is harmless. */
export declare function define(tag: string, element: CustomElementConstructor): void;
/** Dispatches a bubbling, composed `CustomEvent`, the way an element reports out. */
export declare function emit<T>(target: EventTarget, type: string, detail: T): boolean;
/** The first element matching `selector`, or an error naming it. */
export declare function required<T extends Element>(root: ParentNode, selector: string): T;
