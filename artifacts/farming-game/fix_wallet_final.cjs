/**********************************************************************
 FULL SOLANA NFT dAPP (ALL-IN-ONE)
 - Web3 Connection (Alchemy)
 - Wallet (Phantom + Solflare)
 - NFT Mint (Metaplex)
 - Candy Machine Mint
 - Staking (SOL transfer mock)
 - Backend Reward (inline mock API)
 - React UI (single file)
**********************************************************************/

import React, { useMemo, useState } from "react";
import ReactDOM from "react-dom/client";

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";

import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";

import {
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";

import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

import {
  Metaplex,
  walletAdapterIdentity,
  bundlrStorage,
} from "@metaplex-foundation/js";

import "@solana/wallet-adapter-react-ui/styles.css";

/**********************************************************************
 CONFIG
**********************************************************************/
const RPC =
  "https://solana-mainnet.g.alchemy.com/v2/demo123456789abcdef";

const STAKING_POOL = new PublicKey(
  "9xQeWvG816bUx9EPn3bY7kwh28ykVfoUfLgKz7LPOOL1111"
);

const CANDY_MACHINE_ID = new PublicKey(
  "CndyAnrLdpRANDOM111111111111111111111111"
);

/**********************************************************************
 INLINE BACKEND (reward system simulation)
**********************************************************************/
const rewardDB = {};

const backend = {
  stake: (wallet, mint) => {
    rewardDB[wallet] = rewardDB[wallet] || 0;
    rewardDB[wallet] += 10;
  },
  getRewards: (wallet) => rewardDB[wallet] || 0,
};

/**********************************************************************
 CORE APP
**********************************************************************/
const AppContent = () => {
  const wallet = useWallet();
  const [logs, setLogs] = useState([]);
  const [rewards, setRewards] = useState(0);

  const connection = useMemo(() => new Connection(RPC, "confirmed"), []);

  const log = (msg) => {
    setLogs((l) => [...l, msg]);
    console.log(msg);
  };

  /**********************
   MINT NFT
  **********************/
  const mintNFT = async () => {
    if (!wallet.connected) return;

    const metaplex = Metaplex.make(connection)
      .use(walletAdapterIdentity(wallet))
      .use(bundlrStorage());

    const { nft } = await metaplex.nfts().create({
      uri: "https://arweave.net/metadata.json",
      name: "Elite NFT",
      sellerFeeBasisPoints: 500,
    });

    log("NFT Minted: " + nft.address.toBase58());
  };

  /**********************
   CANDY MACHINE MINT
  **********************/
  const mintCandy = async () => {
    if (!wallet.connected) return;

    const metaplex = Metaplex.make(connection).use(
      walletAdapterIdentity(wallet)
    );

    const candyMachine = await metaplex
      .candyMachines()
      .findByAddress({ address: CANDY_MACHINE_ID });

    const { nft } = await metaplex.candyMachines().mint({
      candyMachine,
    });

    log("Candy NFT: " + nft.address.toBase58());
  };

  /**********************
   STAKE
  **********************/
  const stake = async () => {
    if (!wallet.connected) return;

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: STAKING_POOL,
        lamports: 10000000,
      })
    );

    const sig = await wallet.sendTransaction(tx, connection);

    backend.stake(wallet.publicKey.toBase58(), "NFT");

    log("Staked TX: " + sig);
  };

  /**********************
   GET REWARD
  **********************/
  const getReward = () => {
    if (!wallet.connected) return;

    const r = backend.getRewards(wallet.publicKey.toBase58());
    setRewards(r);

    log("Rewards: " + r);
  };

  /**********************
   UI
  **********************/
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        padding: 40,
        background: "#0f172a",
        color: "white",
        minHeight: "100vh",
      }}
    >
      <h1>🚀 SOLANA NFT SUPER DAPP</h1>

      <WalletMultiButton />

      <div style={{ marginTop: 30 }}>
        <button onClick={mintNFT}>Mint NFT</button>
        <button onClick={mintCandy} style={{ marginLeft: 10 }}>
          Candy Mint
        </button>
        <button onClick={stake} style={{ marginLeft: 10 }}>
          Stake
        </button>
        <button onClick={getReward} style={{ marginLeft: 10 }}>
          Get Rewards
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Rewards: {rewards}</h3>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Logs:</h3>
        <pre
          style={{
            background: "#020617",
            padding: 10,
            borderRadius: 10,
            maxHeight: 300,
            overflow: "auto",
          }}
        >
          {logs.join("\n")}
        </pre>
      </div>
    </div>
  );
};

/**********************************************************************
 ROOT
**********************************************************************/
const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

const Root = () => (
  <ConnectionProvider endpoint={RPC}>
    <WalletProvider wallets={wallets} autoConnect>
      <WalletModalProvider>
        <AppContent />
      </WalletModalProvider>
    </WalletProvider>
  </ConnectionProvider>
);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<Root />);