// models/Coin.ts
import { required } from "joi";
import mongoose from "mongoose";

const coinSchema = new mongoose.Schema({
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",

    },
    name: { type: String, required: true },
    ticker: { type: String, required: true },
    description: { type: String },
    decimals: { type: Number, required: true },
    token: { type: String, unique: true, required: true },
    tokenReserves: { type: Number, required: true },
    lamportReserves: { type: Number, required: true },
    url: { type: String, requried: true },
    tokenSupply: { type: Number, required: true },
    progressMcap: { type: Number, required: true },
    date: { type: Date, default: new Date() },
    limit: { type: Number, required: true }
});

const Coin = mongoose.model("Coin", coinSchema);

export default Coin;
