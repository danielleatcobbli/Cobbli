import { describe, it, expect } from "vitest";
import { initialRecommendationSelection, normalizeRecommendations, toggleRecommendation } from "./recommendations";
const lines = normalizeRecommendations([
 {service_id:"stitch",pair_id:"a",name:"Stitch",price_cents:10,choice_group:"Handle"},
 {service_id:"replace",pair_id:"a",name:"Replace",price_cents:20,choice_group:"Handle"},
 {service_id:"stitch",pair_id:"b",name:"Stitch",price_cents:10,choice_group:"Handle"},
]);
describe("repair choices", () => {
 it("keeps selections independent between bags and replaces only same-issue alternatives", () => {
  let selected = toggleRecommendation(lines,new Set(),lines[0].recommendation_id);
  selected=toggleRecommendation(lines,selected,lines[2].recommendation_id);
  selected=toggleRecommendation(lines,selected,lines[1].recommendation_id);
  expect([...selected].sort()).toEqual([lines[1].recommendation_id,lines[2].recommendation_id].sort());
 });
 it("allows skipping and gives repeated catalog services distinct line identities",()=>{
  const selected=toggleRecommendation(lines,new Set([lines[0].recommendation_id]),lines[0].recommendation_id);
  expect(selected.size).toBe(0);expect(lines[0].recommendation_id).not.toBe(lines[2].recommendation_id);
 });
});

describe("preselected drafts",()=>{
 it("chooses staff preference and isolates groups by bag",()=>{
  const preferred = lines.map((line,i)=>({...line,preferred:i===1}));
  expect([...initialRecommendationSelection(preferred,null)].sort()).toEqual([lines[1].recommendation_id,lines[2].recommendation_id].sort());
 });
 it("does not override saved deselections or retain obsolete ids",()=>{
  expect(initialRecommendationSelection(lines,new Set()).size).toBe(0);
  expect(initialRecommendationSelection(lines,new Set(['deleted'])).size).toBe(0);
 });
});
