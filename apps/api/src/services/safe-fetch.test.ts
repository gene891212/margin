import { describe, expect, it } from "vitest";
import { assertPublicUrl } from "./safe-fetch.js";

describe("assertPublicUrl", () => {
  it("rejects local and private literal addresses", async () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "100.64.0.1", "169.254.1.1", "192.168.1.1", "[::1]", "[fe90::1]"]) {
      await expect(assertPublicUrl(new URL(`https://${address}/article`))).rejects.toThrow();
    }
  });

  it("rejects credentials and nonstandard ports", async () => {
    await expect(assertPublicUrl(new URL("https://user:pass@8.8.8.8/article"))).rejects.toThrow();
    await expect(assertPublicUrl(new URL("https://8.8.8.8:8080/article"))).rejects.toThrow();
  });

  it("allows a public HTTPS literal address", async () => {
    await expect(assertPublicUrl(new URL("https://8.8.8.8/article"))).resolves.toBeUndefined();
  });
});
