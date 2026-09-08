import { describe, expect, it } from "vitest";
import { omitUndefinedDeep } from "../omit-undefined.js";

describe("omitUndefinedDeep", () => {
  it("drops undefined keys including nested airline laneId", () => {
    const payload = {
      id: "Q1",
      grossProfit: undefined,
      details: {
        routing: "VIA DXB",
        airlines: [
          { name: "EK", laneId: undefined, kind: "airline", amsFeeBuy: 0 },
          { name: "EY", laneId: "lane_1", kind: undefined },
        ],
      },
    };
    expect(omitUndefinedDeep(payload)).toEqual({
      id: "Q1",
      details: {
        routing: "VIA DXB",
        airlines: [
          { name: "EK", kind: "airline", amsFeeBuy: 0 },
          { name: "EY", laneId: "lane_1" },
        ],
      },
    });
  });

  it("keeps null, 0, false, and empty string", () => {
    expect(omitUndefinedDeep({ a: null, b: 0, c: false, d: "" })).toEqual({
      a: null,
      b: 0,
      c: false,
      d: "",
    });
  });
});
