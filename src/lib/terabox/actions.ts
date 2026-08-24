import { createServerFn } from "@tanstack/react-start";
import { inspectShare, resolveMedia } from "./extract.server.ts";

export const inspectShareFn = createServerFn({ method: "POST" })
  .validator((input: { url: string; dir?: string; password?: string }) => input)
  .handler(async ({ data }) => inspectShare(data.url, data.dir, data.password));

export const resolveMediaFn = createServerFn({ method: "POST" })
  .validator((input: { url: string; fsId: string; password?: string; dir?: string }) => input)
  .handler(async ({ data }) => resolveMedia(data.url, data.fsId, data.password, data.dir));
