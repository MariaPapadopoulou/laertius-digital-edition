import { Router, type IRouter } from "express";
import { GetTimelineResponse } from "@workspace/api-zod";
import { getTimeline } from "../lib/timeline";

const router: IRouter = Router();

let cache: unknown = null;

router.get("/timeline", (req, res) => {
  try {
    if (!cache) cache = GetTimelineResponse.parse(getTimeline());
    res.json(cache);
  } catch (err) {
    req.log.error({ err }, "Failed to build timeline");
    res.status(500).json({ error: "Failed to build timeline" });
  }
});

export default router;
