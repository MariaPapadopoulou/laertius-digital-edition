import { Router, type IRouter } from "express";
import {
  ListSayingsQueryParams,
  ListSayingsResponse,
} from "@workspace/api-zod";
import { listSayings } from "../lib/sayings";

const router: IRouter = Router();

router.get("/sayings", (req, res) => {
  const parsed = ListSayingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const { q, philosopher, topic, book } = parsed.data;
  res.json(
    ListSayingsResponse.parse(listSayings({ q, philosopher, topic, book })),
  );
});

export default router;
