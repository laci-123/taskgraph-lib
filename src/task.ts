/**
 * Representing a task, something to be done.
 *
 * A `Task` can have a name, a deadline, a priority and many more properties. 
 * A `Task` can depend on other tasks: when task „A” depends on task „B” it means
 * that task „A” cannot be started before task „B” is completed.
 */
export interface Task {
    /** uniuqe integer ID*/
    readonly id: number,
    /** name of the `Task`, need not be unique*/
    readonly name: string,
    /** longer description of the `Task`*/
    readonly description: string,
}
