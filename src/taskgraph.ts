import { Task, jsonTaskArray } from "./task";
import { Integer, throw_error } from "./utils";


/**
 * Collection of {@link Task}s with dependencies between them.
 */
export interface TaskGraph {
    roots: Set<Task>,
}

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
            next_instance: tasks.get(next_instance_id) ?? throw_error(`reference to non-existent task: ${next_instance_id}`),
        };
    }

    return { roots };
}
