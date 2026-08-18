import { Router, type IRouter } from "express";
import {
  ListAnecdotesQueryParams,
  ListAnecdotesResponse,
} from "@workspace/api-zod";
import { listAnecdotes } from "../lib/anecdotes";

const router: IRouter = Router();

router.get("/anecdotes", (req, res) => {
  const parsed = ListAnecdotesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const { q, philosopher, topic, book } = parsed.data;
  res.json(
    ListAnecdotesResponse.parse(listAnecdotes({ q, philosopher, topic, book })),
  );
});

export default router;
