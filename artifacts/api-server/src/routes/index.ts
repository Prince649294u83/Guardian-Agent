import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analysisRouter from "./analysis";
import trustRouter from "./trust";
import reportsRouter from "./reports";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analysisRouter);
router.use(trustRouter);
router.use(reportsRouter);
router.use(statsRouter);

export default router;
