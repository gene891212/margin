import type { FastifyInstance } from "fastify";
import { openBrowserLoginSchema } from "@wct/core";
import type { ProfileManager } from "../services/profile-manager.js";

export async function profileRoutes(app: FastifyInstance, input: { profiles: ProfileManager }) {
  app.get("/v1/browser-profile", async () => ({
    profile: await input.profiles.getState()
  }));

  app.post("/v1/browser-profile/open-login", async (request, reply) => {
    const parsed = openBrowserLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_request", details: parsed.error.flatten() });
    }
    const result = await input.profiles.openLogin(parsed.data.loginUrl, parsed.data.browserMode);
    return reply.code(202).send(result);
  });

  app.post("/v1/browser-profile/complete-login", async () => ({
    profile: await input.profiles.completeLogin()
  }));

  app.delete("/v1/browser-profile", async (_request, reply) => {
    await input.profiles.reset();
    return reply.code(204).send();
  });

  // Backward compatibility alias for GET /v1/browser-profiles
  app.get("/v1/browser-profiles", async () => ({
    profile: await input.profiles.getState()
  }));
}
