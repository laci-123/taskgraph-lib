import {z} from "zod";


/**
 * Used to prevent `TypeDoc` from resolving type aliases.
 * See [this issue](https://github.com/TypeStrong/typedoc/issues/1502#issuecomment-775645305)
 * for more details.
 */
export type dummy_type = {_never_used?: never};


/**
 * Integer type.
 */
export type Integer = number & {_never_used: void};

/**
 * Converts a number to an {@link Integer}.
 *
 * Throws error if `x` is not an integer.
 */
export function number_to_int(x: number): Integer {
    if(Number.isInteger(x)) {
        return x as Integer;
    }
    else {
        throw new Error(`${x} is not an integer`);
    }
}

export const z_integer = z.number().int().transform(x => x as Integer);


/**
 * Milliseconds since the [Unix Epoch](https://en.wikipedia.org/wiki/Unix_time).
 * Easy to convert to/from the JavaScript `Date` type.
 * 
 * Uses `Infinity` to represent a point in time that is infinitely far in the future.
 * Uses `Negative Infinity` to represent a point in time that is infinitely far in the past.
 */
export type MillisecondsSinceEpoch = number & dummy_type;


/**
 * A time span in milliseconds.
 */
export type Milliseconds = number & dummy_type;


/**
 * Throw an error.
 *
 * Exactly the same as just throwing an error
 * except that it is an expression while `throw` is a statement,
 * so it can be used in more contexts.
 */
export function throw_error(error: unknown): never {
    throw error;
}
