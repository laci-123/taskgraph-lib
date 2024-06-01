import { ComputedProgress, Task, jsonTaskArray } from "./task";
import { Integer, MillisecondsSinceEpoch, number_to_int, throw_error } from "./utils";


/**
 * Collection of {@link Task}s with dependencies between them.
 */
export interface TaskGraph {
    tasks: Map<Integer, Task>,
    roots: Set<Task>,
}

/**
 * Computes the values of computed properties of the tasks in `tg`.
 */
export function compute(tg: TaskGraph, now: MillisecondsSinceEpoch) {
    const colors = new Map();
    for(const root of tg.roots) {
        colors.set(root, "white");
        depth_first_traverse(root, colors, now);
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

function depth_first_traverse(task: Task, colors: Map<Task, Color>, now: MillisecondsSinceEpoch): ComputedProgress {
    if(colors.get(task) === "gray") {
        throw new Error("Circular dependencies");
    }
    if(task.birthline > task.computed_deadline) {
        throw new Error("Birthline is after deadline");
    }

    if(task.dependencies.length == 0 || colors.get(task) === "black") {
        colors.set(task, "black");
        return task.computed_progress;
    }

    colors.set(task, "gray");

    const dep_cps = new Array<ComputedProgress>();
    for(const dep of task.dependencies) {
        dep.computed_priority = number_to_int(Math.max(dep.computed_priority, task.computed_priority));
        dep.computed_deadline = Math.min(dep.computed_deadline, task.computed_deadline);
        dep_cps.push(depth_first_traverse(dep, colors, now));
    }

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
 * Deserialize a {@link TaskGraph} from a JSON string.
 */
export function tg_from_json(json_str: string): TaskGraph {
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
            dependencies:          [],
            dependees:             [],
            possible_dependencies: [],
            auto_fail:             json_task.auto_fail,
            group_like:            json_task.group_like,
            recurrence:            null,
            finished:              json_task.finished,
        };
        tasks.set(task.id, task);
        roots.add(task);
    }
    
    for(const json_task of json_tasks) {
        const task = tasks.get(json_task.id)!; // This task mus be present in the map because we just put there in the previous loop.
        for(const dep_id of json_task.dependencies) {
            const dep_task = tasks.get(dep_id) ?? throw_error(`reference to non-existent task: ${dep_id}`);
            task.dependencies.push(dep_task);
            dep_task.dependees.push(task);
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
