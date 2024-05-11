export interface Task {
    name: String,
    description: String,
}

export function do_stuff(t: Task) {
    t.description = t.name;
}
