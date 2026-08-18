import { Router, type IRouter } from "express";
import { ListDoxaiQueryParams, ListDoxaiResponse } from "@workspace/api-zod";
import { listDoxai } from "../lib/doxai";

const router: IRouter = Router();

router.get("/doxai", (req, res) => {
  const parsed = ListDoxaiQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters" });
    return;
  }
  const { q, philosopher, domain, book } = parsed.data;
  res.json(ListDoxaiResponse.parse(listDoxai({ q, philosopher, domain, book })));
});

export default router;
