import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  Transaction,
  TransactionResponse,
  clusterApiUrl,
} from '@solana/web3.js';
import base58 from 'bs58';
import { Types } from 'mongoose';
import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor';
import { Usafun } from './usafun'
import idl from "./usafun.json"
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet';
import * as anchor from '@coral-xyz/anchor';
import { io } from '../sockets';
import axios from 'axios';
import Coin from '../models/Coin';
import User from '../models/User';
import { Metaplex } from '@metaplex-foundation/js';
import CoinStatus from '../models/CoinsStatus';
import { coinKing } from '../controller/coinController';
import CurveConfig from '../models/CurveConfig';
// import {
//   Metadata,
// } from '@metaplex/js';

require('dotenv').config();

export const commitmentLevel = "processed";
export const endpoint = process.env.PUBLIC_SOLANA_RPC || clusterApiUrl("devnet");
export const connection = new Connection(endpoint, commitmentLevel);
// export const connection = new Connection('https://white-aged-glitter.solana-mainnet.quiknode.pro/743d4e1e3949c3127beb7f7815cf2ca9743b43a6/');

const privateKey = base58.decode(process.env.PRIVATE_KEY!);

export const pumpProgramInterface = JSON.parse(JSON.stringify(idl));

const adminKeypair = web3.Keypair.fromSecretKey(privateKey);
const adminWallet = new NodeWallet(adminKeypair);
const provider = new AnchorProvider(connection, adminWallet, {
  preflightCommitment: "confirmed",
});
anchor.setProvider(provider);
const program = new Program(
  pumpProgramInterface,
  provider
) as Program<Usafun>;




const metaplex = Metaplex.make(connection);
let token: PublicKey;
// Function to handle `launchEvent`
const handleLaunchEvent = async (event: any) => {
  console.log("Launch Event received:", event);
  try {
    const userId = await User.findOne({ wallet: event.creator })
    const token = await metaplex.nfts().findByMint({ mintAddress: event.mint });

    console.log("userID---->", userId?._id)
    const progressMcap = ((event.tokenSupply.toNumber() * event.reserveLamport.toNumber()) / (event.reserveToken.toNumber() * Math.pow(10, 9))).toFixed(4);
    const newCoin = new Coin({
      creator: userId,
      name: token.name,
      ticker: token.symbol,
      description: token.json?.description,
      decimals: event.decimals,
      token: event.mint,
      tokenReserves: event.reserveToken.toNumber(),
      lamportReserves: event.reserveLamport.toNumber(),
      url: token.json?.image,
      tokenSupply: event.tokenSupply.toNumber(),
      progressMcap,
      limit: event.curveLimit,
    })
    console.log("newCoin--->", newCoin)
    const response = await newCoin.save();
    console.log("newCoin", response.creator)
    const newCoinStatus = new CoinStatus({
      coinId: response._id,
      record: [
        {
          holder: response.creator,//creator,
          holdingStatus: 0,
          amount: 0,
          tx: "txId",
          price: event.reserveLamport.toNumber() / event.reserveToken.toNumber(),
        }
      ]
    })
    await newCoinStatus.save();
    if (io != null) io.emit("TokenCreated", token.name, event.mint)
  } catch (error) {
    console.log("handleLaunchEvent: ", error);
    return "Token create failed"
  }
};

// Function to handle `swapEvent`
const handleSwapEvent = async (event: any) => {
  console.log("Swap Event received:", event);
  await sleep(6000);
  console.log("Swap Event received: sleep end");
  try {
    const coin = await Coin.findOne({ token: event.mint.toString() });
    const userId = await User.findOne({ wallet: event.user }).select('_id');
    console.log("----------------")
    console.log(userId, coin)
    const newTx = {
      holder: userId?._id,
      holdingStatus: event.direction,
      amountIn: event.amountIn.toNumber(),
      amountOut: event.amountOut.toNumber(),
      tx: "tx",
      price: event.reserveLamport.toNumber() / event.reserveToken.toNumber(),
    }
    console.log("Tx", newTx, event.reserveLamport.toNumber())
    CoinStatus.findOne({ coinId: coin?._id })
      .then((coinStatus) => {
        coinStatus?.record.push(newTx);
        coinStatus?.save()
      })
    console.log("handleSwapEvent::tokenSupply ", coin.tokenSupply);
    const progressMcap = ((coin.tokenSupply * event.reserveLamport.toNumber()) / (event.reserveToken.toNumber() * Math.pow(10, 9))).toFixed(4);
    console.log("handleSwapEvent::progressMcap ", progressMcap);
    const updateCoin = await Coin.findOneAndUpdate(
      { token: event.mint },
      { reserveOne: event.reserveToken, reserveTwo: event.reserveLamport, progressMcap },
      { new: true })
    console.log("handleSwapEvent::updateCoin", updateCoin)
    coinKing();
    if (io != null) io.emit("Swap", event.mint, newTx)
  } catch (error) {
    console.log("handleSwapEvent: ", error);
    return "Swap failed"
  }
  console.log("Swap Event received: end");
};

// Function to handle `completeEvent`
const handleCompleteEvent = async (event: any) => {
  console.log("Complete Event received:", event);
  const cpIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_000 });
  const cuIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 });
  const transaction = new Transaction()
  const tx = await program.methods
    .withdraw()
    .accounts(event.mint)
    .instruction()
  transaction.add(cpIx, cuIx, tx);
  transaction.feePayer = adminWallet.publicKey;
  transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  transaction.sign(adminKeypair);
  const sTx = transaction.serialize();
  const signature = await connection.sendRawTransaction(sTx, {
    preflightCommitment: "confirmed",
    skipPreflight: false,
  });
  const blockhash = await connection.getLatestBlockhash();

  const res = await connection.confirmTransaction(
    {
      signature,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight: blockhash.lastValidBlockHeight,
    },
    "confirmed"
  );

};

// Function to handle `withdrawEvent`
const handleWithdrawEvent = async (event: any) => {
  console.log("Withdraw Event received:", event);
  // Handle your withdraw event here
};

// Function to handle `ConfigEvent`
const handleConfigEvent = async (event: any) => {
  console.log("Withdraw Event received:", event);
  // Handle your withdraw event here
  await CurveConfig.updateOne(
    {},
    { $set: { curveLimit: event.curveLimit } },
    { upsert: true } // Create a new document if none exists
  );
};

let eventListenerConnected: boolean = false;

export const listenerForEvents = async () => {
  console.log("Listening for events...");
  if (eventListenerConnected == true) return;
  eventListenerConnected = true
  // Add listeners for each event
  const launchListenerId = program.addEventListener("launchEvent", handleLaunchEvent);
  const swapListenerId = program.addEventListener("swapEvent", handleSwapEvent);
  const completeListenerId = program.addEventListener("completeEvent", handleCompleteEvent);
  const withdrawListenerId = program.addEventListener("withdrawEvent", handleWithdrawEvent);
  // const configListenerId = program.addEventListener("configEvent", handleConfigEvent);
  console.log("Listeners added with IDs:", {
    launch: launchListenerId,
    swap: swapListenerId,
    complete: completeListenerId,
    withdraw: withdrawListenerId,
    // config: configListenerId,
  });
};

// Call the listener function to start listening for events
listenerForEvents().catch(err => {
  console.error("Error setting up listener:", err);
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// TODO: use a better API source
export const getSolPriceInUSD = async () => {
  try {
    // Fetch the price data from CoinGecko
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    const solPriceInUSD = response.data.solana.usd;
    return solPriceInUSD;
  } catch (error) {
    logger.error("Error fetching SOL price:", error);
    throw error;
  }
};

export interface CoinInfo {
  creator: string;
  name: string;
  ticker: string;
  url: string;
  description?: string;
  token: string;
  tokenReserves: number;
  lamportReserves: number;
  marketcap: number;
  presale?: number;
  decimals: number;
}

export type CoinInfoRequest = Omit<
  CoinInfo,
  "tokenReserves" | "lamportReserves" | "marketcap"
> & { tx: string; tokenReserves: number; lamportReserves: number };

export interface ResultType {
  tx: string;
  mint: string;
  user: string;
  swapDirection: number;
  lamportAmount: number;
  tokenAmount: number;
  tokenReserves: number;
  lamportReserves: number;
}
