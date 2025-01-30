import express from "express";
import CoinStatus from "../models/CoinsStatus";
import Coin from "../models/Coin";

const router = express.Router();

router.get("/:mintAddress", async (req, res) => {
  const mintAddress = req.params.mintAddress;
  const coinId = await Coin.findOne({ token: mintAddress }).select("_id");
  if (!coinId) return res.status(404).send("Coin id not found");
  try {
    const coinTrade = await CoinStatus.findOne({ coinId })
      .populate("coinId")
      .populate("record.holder");
    if (!coinTrade) return res.status(404).send("coin status not found");
    res.status(200).send(coinTrade);
  } catch (error) {
    res.status(500).send(error);
  }
});

export default router;
