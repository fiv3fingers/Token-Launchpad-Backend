import express from "express";
import NodeCache from "node-cache";
import { logger } from "../sockets/logger";
import { fetchPriceChartData } from "../utils/chart";



const router = express.Router();

// @route   GET /coin/
// @desc    Get all created coins
// @access  Public
router.get('/:pairIndex/:start/:end/:range/:token/:countBack', async (req, res) => {
    console.log("config+++")
   const {pairIndex, start, end, range, token, countBack}= req.params
   logger.info(`  get charts for pairIndex: ${pairIndex}, start: ${start}, end: ${end}, range: ${range}, token: ${token}`);
   try {
     const data = await fetchPriceChartData(parseInt(pairIndex), parseInt(start) * 1000, parseInt(end) * 1000, parseInt(range), token, parseInt(countBack));
     return res.status(200).send({ table: data });
   } catch (e) {
     console.error(e);
     return res.status(500).send({});
   }
} )

export default router;


