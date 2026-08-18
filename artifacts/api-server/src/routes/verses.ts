import { Router, type IRouter } from "express";
import { ListVersesQueryParams, ListVersesResponse } from "@workspace/api-zod";
import { listVerses } from "../lib/verses";

const router: IRouter = Router();

router.get("/verses", (req, res) => {
  const parsed = ListVersesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const { q, philosopher, book, genre, author } = parsed.data;
  res.json(
    ListVersesResponse.parse(
      listVerses({ q, philosopher, book, genre, author }),
    ),
  );
});

export default router;
