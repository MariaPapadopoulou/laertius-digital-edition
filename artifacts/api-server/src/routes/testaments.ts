import { Router, type IRouter } from "express";
import { ListTestamentsResponse } from "@workspace/api-zod";
import { listTestaments } from "../lib/testaments";

const router: IRouter = Router();

router.get("/testaments", (_req, res) => {
  res.json(ListTestamentsResponse.parse(listTestaments()));
});

export default router;
