import { Router, type IRouter } from "express";
import healthRouter from "./health";
import indoorRouter from "./indoor";

const router: IRouter = Router();

router.use(healthRouter);
router.use(indoorRouter);

export default router;
