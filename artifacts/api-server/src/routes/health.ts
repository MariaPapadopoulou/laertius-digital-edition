import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { denseIndexReady } from "../lib/dense";
import { embedderReady } from "../lib/embedder";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  // denseIndexReady mirrors the Legomena service's health field of the same
  // name: true only when BOTH the committed dense embedding index loaded AND
  // the local embedding model has warmed up. Either failing (e.g. a missing
  // model cache on a host without network access) silently degrades
  // Ask/search retrieval to sparse-only, so surface it here for live checks.
  const data = HealthCheckResponse.parse({
    status: "ok",
    denseIndexReady: denseIndexReady() && embedderReady(),
    // The model is warmed up at startup; until this flips true the first
    // dense search would block on the model load, so deployment checks can
    // poll for readiness here.
    modelReady: embedderReady(),
  });
  res.json(data);
});

export default router;
