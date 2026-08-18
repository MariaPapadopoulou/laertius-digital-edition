import { Router, type IRouter } from "express";
import {
  ListEpistlesQueryParams,
  ListEpistlesResponse,
} from "@workspace/api-zod";
import { listEpistles } from "../lib/epistles";

const router: IRouter = Router();

router.get("/epistles", (req, res) => {
  const parsed = ListEpistlesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const { q, sender, topic, book, authenticity } = parsed.data;
  res.json(
    ListEpistlesResponse.parse(
      listEpistles({ q, sender, topic, book, authenticity }),
    ),
  );
});

export default router;
