import { describe, expect, it } from "vitest";
import { discordAvatarUrl } from "@/lib/discord-avatar";

describe("discordAvatarUrl", () => {
  it("serves an animated avatar (a_ prefix) as .gif", () => {
    const url = discordAvatarUrl({
      id: "127540852686848000",
      avatar: "a_6bc5523021bc4f5df3aa7e2a2446baa3",
    });
    expect(url).toBe(
      "https://cdn.discordapp.com/avatars/127540852686848000/a_6bc5523021bc4f5df3aa7e2a2446baa3.gif",
    );
  });

  it("serves a static avatar as .png", () => {
    const url = discordAvatarUrl({ id: "42", avatar: "abc123" });
    expect(url).toBe("https://cdn.discordapp.com/avatars/42/abc123.png");
  });

  it("falls back to a default embed avatar for modern accounts (disc 0)", () => {
    const url = discordAvatarUrl({ id: "127540852686848000", avatar: null, discriminator: "0" });
    expect(url).toMatch(
      /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png$/,
    );
  });

  it("falls back via legacy discriminator when present", () => {
    const url = discordAvatarUrl({ id: "42", avatar: null, discriminator: "1234" });
    // 1234 % 5 = 4
    expect(url).toBe("https://cdn.discordapp.com/embed/avatars/4.png");
  });
});
