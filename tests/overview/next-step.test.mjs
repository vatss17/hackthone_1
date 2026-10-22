// Pure tests: the overview recommends exactly one next step and never asks for something that already exists.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextStep } from "../../src/lib/overview/next-step.ts";

const factory = [{ id: "f1", name: "Plant" }];
const top = { id: "pipes-and-fittings", name: "Plastic pipes and fittings", reason: "You declared extrusion." };

describe("overview next step", () => {
  it("asks for a factory first", () => {
    const s = nextStep({ factories: [], profileTooThin: true, ownProducts: 0, topOpportunity: null });
    assert.equal(s.kind, "add_factory");
    assert.equal(s.cta.href, "/factories/new");
  });
  it("then for a description of how it makes things, in the guided setup of the existing factory", () => {
    const s = nextStep({ factories: factory, profileTooThin: true, ownProducts: 0, topOpportunity: null });
    assert.equal(s.kind, "describe_factory");
    assert.equal(s.cta.href, "/factories/f1/setup");
  });
  it("then for products", () => {
    const s = nextStep({ factories: factory, profileTooThin: false, ownProducts: 0, topOpportunity: top });
    assert.equal(s.kind, "add_products");
  });
  it("then points at the best opportunity with its reason", () => {
    const s = nextStep({ factories: factory, profileTooThin: false, ownProducts: 2, topOpportunity: top });
    assert.equal(s.kind, "explore");
    assert.match(s.title, /Plastic pipes and fittings/);
    assert.equal(s.why, "You declared extrusion.");
    assert.equal(s.cta.href, "/opportunities/pipes-and-fittings");
  });
  it("falls back to the workspace when nothing else applies", () => {
    assert.equal(nextStep({ factories: factory, profileTooThin: false, ownProducts: 2, topOpportunity: null }).kind, "workspace");
  });
});
