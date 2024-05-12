import {Milliseconds, MillisecondsSinceEpoch, Integer} from "./utils";


/**
 * The progress of a {@link Task}.
 *
 *  - `todo`: not started yet but can be started
 *  - `started`: already started, in progress
 *  - `done`: successfully completed
 *  - `failed`: failed 
 *
 * A task can only be started if all of its dependencies are `done`.
 * If a task becomes `failed` then all of the task that depend on it
 * also automatically fail. 
 */
export type Progress = "todo" | "started" | "done" | "failed";


/**
 * The computed progress of a {@link Task}.
 * Same as {@link Progress} plus these extra variants:
 *
 *  - `blocked`: not all dependencies are `done` yet, so the task cannot be started
 *  - `notyet`: the `birthline` of the task is still in the future, so the task is not yet visible
 */
export type ComputedProgress = Progress | "blocked" | "notyet";


/**
 * The details of how a {@link Task} is recurring.
 */
export interface Recurrence {
    /** When the next instance of the task will be created.*/
    readonly offset: Milliseconds,
    /**
     * When {@link offset} is counted from:
     *
     * - `deadline`: from the task's deadline, even if it was finished after the deadline
     * - `finished`: whenever it was finished, reardless of its deadline
     */
    readonly offset_base: "deadline" | "finished",
    /** Next instance of the task.*/
    readonly next_instance: Task,
}


/**
 * Representing a task, something to be done.
 *
 * A `Task` can have a name, a deadline, a priority and many more properties. 
 * A `Task` can depend on other tasks: when task „A” depends on task „B” it means
 * that task „A” cannot be started before task „B” is completed.
 *
 * A `Task` has multiple "computed" properties, the names of these are all prefixed with `computed_`.
 * These are not stored but calculated in relation of the other tasks this one dependes on and those that depend on this one.
 * For example: if one of the dependencies of a task has higher priority than this one then the computed priority
 * of this task will match the priority of this dependency.
 * This way a lower priority task will never block a higher priority task.
 */
export interface Task {
    /** Uniuqe ID.*/
    readonly id: Integer,

    /** Name of the task, need not be unique but must not be empty.*/
    readonly name: string,

    /** Longer description of the task, may be empty.*/
    readonly description: string,

    /** The point in time until the task must be completed. `Infinity` means the task has no deadline.*/
    readonly deadline: MillisecondsSinceEpoch,

    /** The computed variant of {@link deadline}: the soonest of the deadlines of all the tasks that depend on this one.*/
    readonly computed_deadline: MillisecondsSinceEpoch,

    /** An integer representing the priority of the task: higher values mean more important, lower values means less important. Default is 0.*/
    readonly priority: Integer,

    /** The computed variant of {@link priority}: the highest of the priorities of all the tasks that depend on this one.*/
    readonly computed_priority: Integer,

    /** The progress of the task: `todo`, `done` etc.*/
    readonly progress: Progress,

    /** The computed variant of {@link progress}.*/
    readonly computed_progress: ComputedProgress,

    /**
     * The point in time before which the task cannot be started. `Negative Infinity` means the task has no birthline.
     * 
     * (I don't know what the proper English term is. I came up with "birthline" because it's kind of the opposite of "deadline".)
     */
    readonly birthline: MillisecondsSinceEpoch,

    /** The tasks this task depends on.*/
    readonly dependencies: Array<Task>,

    /** The tasks that depend on this task. This is a computed property, only the {@link dependencies} are stored.*/
    readonly dependees: Array<Task>,

    /**
     * The tasks that can be added as a dependency to this task without causing a dependency-cycle.
     * Does not contain the tasks that are already depedencies of this task.
     * This is a computed property.
     */
    readonly possible_dependencies: Array<Task>,

    /** If `true` then the task automatically becomes `failed` when it is passed its deadline.*/
    readonly auto_fail: boolean,

    /** If `true` then the task automatically becomes `done` when all of its dependencies are done.*/
    readonly group_like: boolean,

    /** How the task is recurring. If `null` then it is not a recurring task.*/
    readonly recurrence: Recurrence | null,
}
