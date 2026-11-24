import { describe, expect, it } from "vitest";
import {
  buildFirestoreDocumentUrl,
  fromFirestoreDocument,
  toFirestoreFields,
} from "./firestore-rest";

describe("firestore-rest", () => {
  it("membentuk URL database bernama dengan benar", () => {
    const url = buildFirestoreDocumentUrl(
      { projectId: "semiotic-storm-4k4jk", databaseId: "ai-studio-db" },
      "/appConfig/owner",
    );
    expect(url).toBe(
      "https://firestore.googleapis.com/v1/projects/semiotic-storm-4k4jk/databases/ai-studio-db/documents/appConfig/owner",
    );
  });

  it("round-trip tipe data Firestore", () => {
    const input = {
      ownerEmail: "owner@example.com",
      monthlyBudgetUsd: 10.5,
      voiceoverWpm: 140,
      isActive: true,
      tags: ["tiktok", "shopee"],
      nested: { passed: true, score: 88 },
      nullable: null,
    };
    const fields = toFirestoreFields(input);
    expect(fields.voiceoverWpm).toEqual({ integerValue: "140" });
    expect(fields.monthlyBudgetUsd).toEqual({ doubleValue: 10.5 });
    expect(fromFirestoreDocument({ fields })).toEqual(input);
  });
});
