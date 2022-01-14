<script lang="ts">
  import { onMount } from "svelte";

  import twitterLogo from "./assets/twitter-logo.svg";
  import joachimImg from "./assets/nft/0.png";
  import odsonneImg from "./assets/nft/1.png";
  import michaelImg from "./assets/nft/2.png";

  import CandyMachine from "./lib/CandyMachine.svelte";
  import { walletAddress } from "./stores";

  const NFT_IMAGES = [
    {
      src: joachimImg,
      name: "Joachim Andersen",
    },
    {
      src: odsonneImg,
      name: "Odsonne Edouard",
    },
    {
      src: michaelImg,
      name: "Michael Olise",
    },
  ];

  const TWITTER_HANDLE = "_buildspace";
  const TWITTER_LINK = `https://twitter.com/${TWITTER_HANDLE}`;

  let solana = null;

  async function connectTrustedWallet() {
    if (solana.isPhantom) {
      console.log("Phantom wallet found!");
      const response = await solana.connect({ onlyIfTrusted: true });
      console.log("Connected with Public Key:", response.publicKey.toString());
      walletAddress.set(response.publicKey.toString());
    } else {
      alert("Solana object not found! Get a Phantom Wallet 👻");
    }
  }

  async function handleConnectWallet() {
    const response = await solana.connect();
    console.log("Connected with Public Key:", response.publicKey.toString());
    walletAddress.set(response.publicKey.toString());
  }

  onMount(() => {
    solana = window?.solana;
    if (solana) {
      connectTrustedWallet();
    } else {
      console.log("Login To Phantom!");
    }
  });
</script>

<main class="App">
  <div class="container">
    <div class="header-container">
      <p class="header">
        <span class="candy-icon">🍭 </span>
        <span class="candy-title">Candy Drop</span>
      </p>
      <p class="sub-text">Collect CPFC Player NFTs</p>
      {#if !$walletAddress}
        <button
          class="cta-button connect-wallet-button"
          on:click={handleConnectWallet}
        >
          Connect to Wallet
        </button>
      {/if}
    </div>

    {#if $walletAddress}
      <CandyMachine walletAddress={window.solana} />
    {/if}

    <div class="nft-images">
      {#each NFT_IMAGES as { src, name }}
        <img {src} alt={name} width="200" />
      {/each}
    </div>

    <div class="footer-container">
      <img alt="Twitter Logo" class="twitter-logo" src={twitterLogo} />
      <a
        class="footer-text"
        href={TWITTER_LINK}
        target="_blank"
        rel="noreferrer">{`built on @${TWITTER_HANDLE}`}</a
      >
    </div>
  </div>
</main>

<style>
  :root {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
      Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  }

  .nft-images {
    margin-top: 2rem;
  }
</style>
