import type { FastifyInstance } from "fastify";
import { createBrowserProfileSchema } from "@wct/core";
import { AppError } from "../services/errors.js";
import type { ProfileManager } from "../services/profile-manager.js";

export async function profileRoutes(app: FastifyInstance, input: { profiles: ProfileManager }) {
  app.get("/v1/browser-profiles", async () => ({ profiles: input.profiles.list() }));

  app.post("/v1/browser-profiles", async (request, reply) => {
    const parsed = createBrowserProfileSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    const profile = await input.profiles.create(parsed.data.name, parsed.data.loginUrl);
    return reply.code(201).send(profile);
  });

  app.get<{ Params: { id: string } }>("/v1/browser-profiles/:id", async (request) =>
    input.profiles.get(request.params.id));

  app.post<{ Params: { id: string } }>("/v1/browser-profiles/:id/open-login", async (request, reply) => {
    const parsed = createBrowserProfileSchema.pick({ loginUrl: true }).safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    return reply.code(202).send(await input.profiles.openLogin(request.params.id, parsed.data.loginUrl));
  });

  app.post<{ Params: { id: string } }>("/v1/browser-profiles/:id/complete-login", async (request) =>
    input.profiles.completeLogin(request.params.id));

  app.post<{ Params: { id: string } }>("/v1/browser-profiles/:id/allowed-hosts", async (request, reply) => {
    const body = request.body as { hostname?: unknown } | null;
    if (typeof body?.hostname !== "string" || !body.hostname.trim()) {
      throw new AppError("invalid_host", "Provide a hostname", 400);
    }
    return reply.send(await input.profiles.addAllowedHost(request.params.id, body.hostname.trim()));
  });

  app.delete<{ Params: { id: string } }>("/v1/browser-profiles/:id", async (request, reply) => {
    await input.profiles.delete(request.params.id);
    return reply.code(204).send();
  });
}
