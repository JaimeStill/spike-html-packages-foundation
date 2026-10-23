// The foundation's Intl formatters, declared; spike-html-apps implements them.
// From spike-html-conventions (a88828a): layers/foundation/format.d.ts.

/** Options for formatBytes: Intl.NumberFormat's, less its style and unit, which it sets. */
export type BytesOptions = Omit<Intl.NumberFormatOptions, "style" | "unit">;

/** A byte count in SI units, base 1000 (kB, MB, GB, ...), with Intl.NumberFormat's byte units. */
export declare function formatBytes(
  bytes: number,
  locale?: Intl.LocalesArgument,
  options?: BytesOptions,
): string;

/** A calendar date, dateStyle "medium" by default. */
export declare function formatDate(
  date: Date | number,
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
): string;

/** A date and time, dateStyle "medium" and timeStyle "short" by default. */
export declare function formatDateTime(
  date: Date | number,
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions,
): string;

/** Options for formatRelative: Intl.RelativeTimeFormat's, and the moment it is relative to, the
 * current time by default. */
export interface RelativeOptions extends Intl.RelativeTimeFormatOptions {
  now?: Date | number;
}

/** A date relative to now in its largest whole unit ("3 days ago", "in 2 hours"). */
export declare function formatRelative(
  date: Date | number,
  locale?: Intl.LocalesArgument,
  options?: RelativeOptions,
): string;

/** Options for formatDuration: Intl.DurationFormat's style, "short" by default. */
export interface DurationOptions {
  style?: "long" | "short" | "narrow" | "digital";
}

/** A duration given in milliseconds, in days, hours, minutes, and seconds, by Intl.DurationFormat. */
export declare function formatDuration(
  milliseconds: number,
  locale?: Intl.LocalesArgument,
  options?: DurationOptions,
): string;
