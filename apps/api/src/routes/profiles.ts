import type { FastifyInstance } from "fastify";
import { createBrowserProfileSchema } from "@wct/core";
import { z } from "zod";
import type { ProfileManager } from "../services/profile-manager.js";

export async function profileRoutes(app: FastifyInstance, input: { profiles: ProfileManager }) {
  app.get("/v1/browser-profiles", async () => ({ profiles: input.profiles.list() }));

  app.post("/v1/browser-profiles", async (request, reply) => {
    const parsed = createBrowserProfileSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    const profile = await input.profiles.create(parsed.data.name);
    return reply.code(201).send(profile);
  });

  app.get<{ Params: { id: string } }>("/v1/browser-profiles/:id", async (request) =>
    input.profiles.get(request.params.id));

  app.post<{ Params: { id: string } }>("/v1/browser-profiles/:id/open-login", async (request, reply) => {
    const parsed = z.object({
      loginUrl: z.string().url(),
      browserMode: z.enum(["desktop", "mobile"]).default("desktop")
    }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    return reply.code(202).send(await input.profiles.openLogin(request.params.id, parsed.data.loginUrl, parsed.data.browserMode));
  });

  app.post<{ Params: { id: string } }>("/v1/browser-profiles/:id/complete-login", async (request) =>
    input.profiles.completeLogin(request.params.id));

  app.delete<{ Params: { id: string } }>("/v1/browser-profiles/:id", async (request, reply) => {
    await input.profiles.delete(request.params.id);
    return reply.code(204).send();
  });
}
