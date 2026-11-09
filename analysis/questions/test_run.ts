// Test run with a fictional persona. Run: `node test_run.ts` (Node 22.18+) or `npx tsx test_run.ts`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { score_enneagram, score_attachment, score_kolbe_proxy, score_bigfive, score_working_genius, score_chronotype, score_values,
  parseScaleAnswer, parseOptionAnswer, parseEnergyAnswer, parseSimilarityAnswer, parseClockAnswer } from "./scoring.ts";
const here = fileURLToPath(new URL(".", import.meta.url));
const load = (f: string) => JSON.parse(readFileSync(here + f, "utf8"));
const E = load("enneagram.json"), A = load("attachment.json"), K = load("kolbe_proxy.json");
const B5 = load("bigfive.json"), WG = load("working_genius.json"), CH = load("chronotype.json"), VA = load("values.json");

// Persona "Nadia": a restless founder type. Expect Enneagram 7w8 sx-first, avoidant attachment, Kolbe roughly 2-3-9-5.
const enneagram = {
  E1a: 2, E1b: 2, E1c: 2, E1d: 4,  E2a: 3, E2b: 4, E2c: 2, E2d: 4,  E3a: 4, E3b: 4, E3c: 3, E3d: 3,
  E4a: 2, E4b: 2, E4c: 3, E4d: 4,  E5a: 3, E5b: 2, E5c: 3, E5d: 4,  E6a: 2, E6b: 2, E6c: 1, E6d: 5,
  E7a: 5, E7b: 5, E7c: 5, E7d: 1,  E8a: 4, E8b: 4, E8c: 4, E8d: 2,  E9a: 1, E9b: 2, E9c: 1, E9d: 5,
  D37: 2, D16: 3, D29: 4, D59: 4, D46: 2, D83: 4,
  I_sp1: 2, I_sp2: 3, I_so1: 3, I_so2: 3, I_sx1: 5, I_sx2: 5,
};
const attachment = { A1: 2, A2: 2, A3: 4, A4: 1, A5: 2, A6: 2, A7: 4, A8: 2,
                     V1: 5, V2: 4, V3: 2, V4: 5, V5: 4, V6: 4, V7: 2, V8: 4 };
const kolbe = { FF1: "a", FF2: "c", FF3: "a", FF4: "b", FF5: "b", FF6: "c",   // simplify
                FT1: "c", FT2: "a", FT3: "a", FT4: "b", FT5: "b", FT6: "c",   // adapt
                QS1: "a", QS2: "b", QS3: "c", QS4: "a", QS5: "b", QS6: "c",   // innovate
                IM1: "b", IM2: "c", IM3: "a", IM4: "b", IM5: "c", IM6: "a" }; // restore

const show = (title: string, v: unknown) => console.log(`\n== ${title} ==\n` + JSON.stringify(v, null, 1));
show("enneagram", score_enneagram(enneagram, E));
show("attachment", score_attachment(attachment, A));
const k = score_kolbe_proxy(kolbe, K);
show("kolbe_proxy", { ...k, conables: undefined });
console.log("conables.quick_start:", JSON.stringify(k.conables.quick_start));

// Adaptive checkpoint: the enneagram scored on only the first 27 items (rounds a, b, c)
const partial = Object.fromEntries(Object.entries(enneagram).filter(([id]) => /^E\d[abc]$/.test(id)));
const p = score_enneagram(partial, E);
show("enneagram checkpoint after 27 items", { type: p.type, runner_up: p.runner_up, confidence: p.confidence, contenders: p.contenders });

// Voice parser spot checks
const phrases = ["yeah pretty much", "not at all", "hmm, kind of, sometimes", "four", "I'd say 8 out of 10", "not completely", "absolutely", "honestly no", "it depends on the day", "banana"];
show("parseScaleAnswer", Object.fromEntries(phrases.map(s => [s, parseScaleAnswer(s).value])));
const ff1 = K.items[0].options;
show("parseOptionAnswer (FF1)", Object.fromEntries(["b", "the first one", "I'd probably dig into the data and the history", "I just get the gist and go", "uh, neither"].map(s => [s, parseOptionAnswer(s, ff1)])));

// ---- Same persona, the four newer banks ----
// Expect: high openness and extraversion (assertive), low conscientiousness (low orderliness), average agreeableness, decent stability;
// genius Invention + Galvanizing, frustration Enablement + Tenacity; moderate evening type; stimulation / self-direction on top, tradition / conformity at the bottom.
const bigfive = { FO1: 5, FO2: 3, FO3: 5, FO4: 1, FO5: 1, FO6: 2,   FC1: 2, FC2: 2, FC3: 2, FC4: 4, FC5: 4, FC6: 3,
                  FE1: 4, FE2: 5, FE3: 5, FE4: 1, FE5: 1, FE6: 1,   FA1: 3, FA2: 3, FA3: 4, FA4: 3, FA5: 2, FA6: 3,
                  FS1: 4, FS2: 4, FS3: 3, FS4: 2, FS5: 2, FS6: 3 };
const workingGenius = { W1: 4, W2: 4, W3: 3,  I1: 5, I2: 5, I3: 5,  D1: 4, D2: 3, D3: 4,  G1: 5, G2: 4, G3: 5,  N1: 2, N2: 1, N3: 2,  T1: 1, T2: 1, T3: 2,
                        WC: 4, IC: 5, DC: 4, GC: 4, NC: 3, TC: 2 };
const chronotype = { K_wake: "8:30", K_bed: "1 am", K1: 2, K2: 4, K3: 2, K4: 4, K5: 1, K6: 4, K7: 2, K8: 4, K9: 2, K10: 4 };
const values = { SD1: 6, ST1: 6, HE1: 5, AC1: 5, PO1: 3, SE1: 2, CO1: 2, TR1: 2, BE1: 4, UN1: 4,
                 SD2: 6, ST2: 6, HE2: 4, AC2: 5, PO2: 4, SE2: 2, CO2: 1, TR2: 1, BE2: 4, UN2: 4, UN3: 3 };

show("bigfive", score_bigfive(bigfive, B5));
show("working_genius", score_working_genius(workingGenius, WG));
show("chronotype", score_chronotype(chronotype, CH));
show("values", score_values(values, VA));

// Adaptive checkpoints for the new sections
const b5Partial = Object.fromEntries(Object.entries(bigfive).filter(([id]) => !/6$/.test(id)));
const bp = score_bigfive(b5Partial, B5);
show("bigfive checkpoint after 25 items", { domain_confidence: bp.domain_confidence, confidence: bp.confidence });
const wgPartial = Object.fromEntries(Object.entries(workingGenius).filter(([id]) => /^[WIDGNT][12]$/.test(id)));
const wp = score_working_genius(wgPartial, WG);
show("working_genius checkpoint after 12 energy items", { genius: wp.genius, frustration: wp.frustration, confidence: wp.confidence });
const chPartial = Object.fromEntries(Object.entries(chronotype).filter(([id]) => !/^K(9|10)$/.test(id)));
const cp = score_chronotype(chPartial, CH);
show("chronotype checkpoint after 10 items", { label: cp.label, score: cp.score, confidence: cp.confidence });

// Voice parsers for the new scales
const energy = ["that drains me", "love it", "neutral", "a bit draining", "yeah, energizing", "honestly, meh", "two", "it kills me", "not at all"];
show("parseEnergyAnswer", Object.fromEntries(energy.map(s => [s, parseEnergyAnswer(s).value])));
const sim = ["very much like me", "not like me at all", "a little like me", "that's me", "not really", "somewhat", "six", "8 out of 10", "banana"];
show("parseSimilarityAnswer", Object.fromEntries(sim.map(s => [s, parseSimilarityAnswer(s).value])));
const clocks: Array<[string, "wake" | "bed"]> = [["6:30", "wake"], ["half past seven", "wake"], ["around 9", "wake"], ["11", "bed"], ["eleven thirty pm", "bed"], ["1 am", "bed"], ["midnight", "bed"], ["23:45", "bed"], ["whenever", "bed"]];
show("parseClockAnswer", Object.fromEntries(clocks.map(([s, k]) => [s + " (" + k + ")", parseClockAnswer(s, k)])));
