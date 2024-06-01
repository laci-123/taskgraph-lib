import { ComputedProgress, Progress, Task, default_task, jsonTaskArray } from "./task";
import { Integer, Milliseconds, MillisecondsSinceEpoch, number_to_int, throw_error } from "./utils";


/**
 * Parameters of a task the user can set.
 */
export interface TaskParams {
    name?: string,
    description?: string,
    deadline?: MillisecondsSinceEpoch,
    priority?: Integer,
    progress?: Progress,
    birthline?: MillisecondsSinceEpoch,
    dependencies?: Array<Integer>,
    auto_fail?: boolean,
    group_like?: boolean,
    recurrence?: {
        recurrence_base: "deadline" | "finished",
        recurrence_offset: Milliseconds,
    } | null,
}

/**
 * Collection of {@link Task}s with dependencies between them.
 */
export interface TaskGraph {
    tasks: Map<Integer, Task>,
    roots: Set<Task>,
}

/**
 * Loads a {@link TaskGraph} from JSON.
 */
export function load_tasks(json_string: string, now: MillisecondsSinceEpoch): TaskGraph {
    const tg = tg_from_json(json_string);
    compute(tg, now);
    return tg;
}

/**
 * Create a JSON string from the {@link TaskGraph}.
 */
export function save_tasks(tg: TaskGraph): string {
    const jsonTasks = new Array();

    for(const task of tg.tasks.values()) {
        const dependencies = new Array<Integer>();
        for(const dep of task.dependencies) {
            dependencies.push(dep.id);
        }

        let recurrence = task.recurrence ? {
                offset:        task.recurrence.offset,
                offset_base:   task.recurrence.offset_base,
                next_instance: task.recurrence.next_instance?.id,
            } :
            null;

        jsonTasks.push({
            id:           task.id,
            description:  task.description,
            priority:     task.priority,
            progress:     task.progress,
            birthline:    task.birthline === Number.NEGATIVE_INFINITY ? null : task.birthline,
            deadline:     task.deadline  === Number.POSITIVE_INFINITY ? null: task.deadline,
            auto_fail:    task.auto_fail,
            group_like:   task.group_like,
            finished:     task.finished,
            dependencies: dependencies,
            recurrence,
        });
    }

    return JSON.stringify(jsonTasks, undefined, 4);
}

/**
 * Gets all tasks, or all tasks whose computed progress matches `filter`.
 */
export function get_all_tasks(tg: TaskGraph, filter?: Progress): Set<Task> {
    if(filter) {
        const tasks = new Set<Task>();
        for(const task of tg.tasks.values()) {
            if(task.computed_progress === filter) {
                tasks.add(task);
            }
        }
        return tasks;
    }
    else {
        return new Set(tg.tasks.values());
    }
}

/**
 * Creates a new task by the given ID, or updates it if it already exists.
 */
export function create_or_update_task(tg: TaskGraph, id: Integer, params: TaskParams, now: MillisecondsSinceEpoch) {
    let task = tg.tasks.get(id);
    if(!task) {
        task = default_task(id);
        tg.roots.add(task);
    }
    if(params.name) {
        task.name = params.name;
    }
    if(params.description) {
        task.description = params.description;
    }
    if(params.deadline) {
        task.deadline = params.deadline;
        task.computed_deadline = params.deadline;
    }
    if(params.priority) {
        task.priority = params.priority;
        task.computed_priority = params.priority;
    }
    if(params.progress) {
        task.progress = params.progress;
        task.computed_progress = params.progress;
    }
    if(params.birthline) {
        task.birthline = params.birthline;
    }
    if(params.auto_fail) {
        task.auto_fail = params.auto_fail;
    }
    if(params.group_like) {
        task.group_like = params.group_like;
    }
    if(params.dependencies) {
        const new_deps = new Set<Task>();
        for(const dep_id of params.dependencies) {
            const dep = tg.tasks.get(dep_id) ?? throw_error(`reference to non-existent task: ${dep_id}`);
            new_deps.add(dep);
        }
        for(const dep of task.dependencies) {
            if(!new_deps.has(dep)) {
                dep.dependees.delete(task);
                if(dep.dependees.size === 0) {
                    tg.roots.add(dep);
                }
            }
        }
        task.dependencies = new_deps;
        for(const dep of task.dependencies) {
            dep.dependees.add(task);
            tg.roots.delete(dep);
        }
    }
    if(params.recurrence) {
        task.recurrence = {
            offset_base: params.recurrence.recurrence_base,
            offset: params.recurrence.recurrence_offset,
            next_instance: null, // will be set by compute
        }
    }
    else if(params.recurrence === null){
        task.recurrence = null;
    }

    compute(tg, now);
}

/**
 * Gets a task by ID.
 *
 * If no tasks exists with the given ID then returns `undefined`.
 */
export function get_task(tg: TaskGraph, id: Integer): Task | undefined {
    return tg.tasks.get(id);
}

/**
 * Deletes a task by ID.
 * 
 * If not tasks exists with the given ID then does not do anything.
 * Throws an error if others tasks depend on the task with the given ID.
 */
export function delete_task(tg: TaskGraph, id: Integer) {
    const task = tg.tasks.get(id);
    if(task) {
        if(task.dependees.size > 0) {
            throw new Error("Cannot delete task because other tasks depend on it");
        }
        else {
            tg.tasks.delete(id);
            tg.roots.delete(task);
        }
    }
}

/**
 * Computes the values of computed properties of the tasks in `tg`.
 */
function compute(tg: TaskGraph, now: MillisecondsSinceEpoch) {
    const colors = new Map();
    for(const root of tg.roots) {
        colors.set(root, "white");
        const possible_dependencies = new Set(tg.tasks.values());
        depth_first_traverse(root, colors, now, possible_dependencies);
    }

    for(const task of tg.tasks.values()) {
        if(task.recurrence) {
            if(task.computed_progress === "done") {
                let next_deadline: MillisecondsSinceEpoch;
                if(task.recurrence.offset_base === "deadline") {
                    next_deadline = task.computed_deadline + task.recurrence.offset;
                }
                else {
                    next_deadline = task.finished! + task.recurrence.offset; // When task is done then finished is always set (see #1).
                }
                const next_instance = structuredClone(task);
                next_instance.deadline = next_deadline;
                next_instance.computed_deadline = next_deadline;
                next_instance.id = smallest_available_id(tg); 
                task.recurrence.next_instance = next_instance;
            }
            else {
                task.recurrence.next_instance = null;
            }
        }
    }
}

type Color = "black" | "gray" | "white";

function depth_first_traverse(task: Task, colors: Map<Task, Color>, now: MillisecondsSinceEpoch, possible_dependencies: Set<Task>): ComputedProgress {
    if(colors.get(task) === "gray") {
        throw new Error("Circular dependencies");
    }
    if(task.birthline > task.computed_deadline) {
        throw new Error("Birthline is after deadline");
    }

    if(task.dependencies.size == 0 || colors.get(task) === "black") {
        colors.set(task, "black");
        return task.computed_progress;
    }

    colors.set(task, "gray");
    possible_dependencies.delete(task);

    const dep_cps = new Array<ComputedProgress>();
    for(const dep of task.dependencies) {
        dep.computed_priority = number_to_int(Math.max(dep.computed_priority, task.computed_priority));
        dep.computed_deadline = Math.min(dep.computed_deadline, task.computed_deadline);
        dep_cps.push(depth_first_traverse(dep, colors, now, possible_dependencies));
    }

    task.possible_dependencies = possible_dependencies;

    const old_computed_progress = task.computed_progress;

    if(task.progress === "todo" || task.progress === "started" || task.progress === "done") {
        if(dep_cps.some(dep_cp => dep_cp === "failed")) {
            task.computed_progress = "failed";
        }
        else if(dep_cps.some(dep_cp => dep_cp === "notyet")) {
            task.computed_progress = "notyet";
        }
        else if(dep_cps.every(dep_cp => dep_cp === "done")) {
            if(now < task.birthline) {
                task.computed_progress = "notyet";
            }
            else if(task.auto_fail && task.computed_progress !== "done" && now > task.computed_deadline) {
                task.computed_progress = "failed";
            }
            else if(task.group_like) {
                task.computed_progress = "done";
            }
            else {
                task.computed_progress = task.progress;
            }
        }
        else {
            task.computed_progress = "blocked";
        }
    }
    else if(task.progress === "failed") {
        task.computed_progress = "failed";
    }

    // #1
    if(old_computed_progress !== "done" && task.computed_progress === "done") {
        task.finished = now;
    }
    else if(old_computed_progress === "done" && task.computed_progress !== "done") {
        task.finished = null;
    }

    colors.set(task, "black");
    return task.computed_progress;
}

function smallest_available_id(tg: TaskGraph): Integer {
    for(let i = 0; i < tg.tasks.size; ++i) {
        if(!(tg.tasks.has(number_to_int(i)))) {
            return number_to_int(i);
        }
    }
    return number_to_int(tg.tasks.size);
}

/**
 * Deserializes a {@link TaskGraph} from a JSON string.
 */
function tg_from_json(json_str: string): TaskGraph {
    const json: any  = JSON.parse(json_str);
    const json_tasks = jsonTaskArray.parse(json.tasks);
    const tasks = new Map<Integer, Task>();
    const roots = new Set<Task>();
    for(const json_task of json_tasks) {
        const task: Task = {
            id:                    json_task.id,
            name:                  json_task.name,
            description:           json_task.description,
            deadline:              json_task.deadline,
            computed_deadline:     json_task.deadline,
            priority:              json_task.priority,
            computed_priority:     json_task.priority,
            progress:              json_task.progress,
            computed_progress:     json_task.progress,
            birthline:             json_task.birthline,
            dependencies:          new Set(),
            dependees:             new Set(),
            possible_dependencies: new Set(),
            auto_fail:             json_task.auto_fail,
            group_like:            json_task.group_like,
            recurrence:            null,
            finished:              json_task.finished,
        };
        tasks.set(task.id, task);
        roots.add(task);
    }
    
    for(const json_task of json_tasks) {
        const task = tasks.get(json_task.id)!; // This task must be present in the map because we just put there in the previous loop.
        for(const dep_id of json_task.dependencies) {
            const dep_task = tasks.get(dep_id) ?? throw_error(`reference to non-existent task: ${dep_id}`);
            task.dependencies.add(dep_task);
            dep_task.dependees.add(task);
            roots.delete(task);
        }
        const next_instance_id = json_task.recurrence.next_instance;
        task.recurrence = {
            offset: json_task.recurrence.offset,
            offset_base: json_task.recurrence.offset_base,
            next_instance: tasks.get(next_instance_id) ?? null,
        };
    }

    return { tasks, roots };
}
