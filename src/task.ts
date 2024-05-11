import {z} from "zod";


const taskSchema = z.object({
    name: z.string(),
    description: z.string(),
});

export type Task = z.infer<typeof taskSchema>;

export function do_stuff(t: Task) {
    t.description = t.name;
}
