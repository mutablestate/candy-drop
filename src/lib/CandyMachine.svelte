<script>
  import { onMount } from "svelte";
  import { Connection, PublicKey } from "@solana/web3.js";
  import { Program, Provider, web3 } from "@project-serum/anchor";
  import { MintLayout, TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";

  import { sendTransactions } from "../utils/connection";
  import {
    candyMachineProgram,
    TOKEN_METADATA_PROGRAM_ID,
    SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
    getAtaForMint,
    getNetworkExpire,
    getNetworkToken,
    CIVIC,
  } from "../utils/helpers";
  import CountdownTimer from "./CountdownTimer.svelte";
  import { candyMachineData } from "../stores";

  export let walletAddress;

  let candyMachine;
  let isMinting = false;

  const { SystemProgram } = web3;

  // Solana provider
  function getProvider() {
    const rpcHost = import.meta.env.VITE_SOLANA_RPC_HOST;
    const connection = new Connection(rpcHost);
    const provider = new Provider(connection, window.solana, {
      preflightCommitment: "processed",
    });
    return provider;
  }

  async function getCandyMachineState() {
    const provider = getProvider();

    // Get metadata about your deployed candy machine program
    const idl = await Program.fetchIdl(candyMachineProgram, provider);

    // Create a program that you can call
    const program = new Program(idl, candyMachineProgram, provider);

    // Fetch the metadata from your candy machine
    candyMachine = await program.account.candyMachine.fetch(
      import.meta.env.VITE_CANDY_MACHINE_ID
    );

    // Parse out all our metadata and log it out
    const itemsAvailable = candyMachine.data.itemsAvailable.toNumber();
    const itemsRedeemed = candyMachine.itemsRedeemed.toNumber();
    const itemsRemaining = itemsAvailable - itemsRedeemed;
    const goLiveData = candyMachine.data.goLiveDate.toNumber();
    const presale =
      candyMachine.data.whitelistMintSettings &&
      candyMachine.data.whitelistMintSettings.presale &&
      (!candyMachine.data.goLiveDate ||
        candyMachine.data.goLiveDate.toNumber() > new Date().getTime() / 1000);

    // We will be using this later in our UI so let's generate this now
    const goLiveDateTimeString = `${new Date(goLiveData * 1000).toLocaleString(
      "en-GB",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        timeZoneName: "short",
        timeZone: "UTC",
      }
    )}`;

    candyMachineData.set({
      id: import.meta.env.VITE_CANDY_MACHINE_ID,
      program,
      state: {
        itemsAvailable,
        itemsRedeemed,
        itemsRemaining,
        goLiveData,
        goLiveDateTimeString,
        isSoldOut: itemsRemaining === 0,
        isActive:
          (presale ||
            candyMachine.data.goLiveDate.toNumber() <
              new Date().getTime() / 1000) &&
          (candyMachine.endSettings
            ? candyMachine.endSettings.endSettingType.date
              ? candyMachine.endSettings.number.toNumber() >
                new Date().getTime() / 1000
              : itemsRedeemed < candyMachine.endSettings.number.toNumber()
            : true),
        isPresale: presale,
        goLiveDate: candyMachine.data.goLiveDate,
        treasury: candyMachine.wallet,
        tokenMint: candyMachine.tokenMint,
        gatekeeper: candyMachine.data.gatekeeper,
        endSettings: candyMachine.data.endSettings,
        whitelistMintSettings: candyMachine.data.whitelistMintSettings,
        hiddenSettings: candyMachine.data.hiddenSettings,
        price: candyMachine.data.price,
      },
    });

    console.log({
      itemsAvailable,
      itemsRedeemed,
      itemsRemaining,
      goLiveData,
      goLiveDateTimeString,
      presale,
    });
  }

  async function getCandyMachineCreator(candyMachine) {
    const candyMachineID = new PublicKey(candyMachine);
    return await web3.PublicKey.findProgramAddress(
      [Buffer.from("candy_machine"), candyMachineID.toBuffer()],
      candyMachineProgram
    );
  }

  async function getMetadata(mint) {
    return (
      await PublicKey.findProgramAddress(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      )
    )[0];
  }

  async function getMasterEdition(mint) {
    return (
      await PublicKey.findProgramAddress(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
          Buffer.from("edition"),
        ],
        TOKEN_METADATA_PROGRAM_ID
      )
    )[0];
  }

  function createAssociatedTokenAccountInstruction(
    associatedTokenAddress,
    payer,
    walletAddress,
    splTokenMintAddress
  ) {
    const keys = [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
      { pubkey: walletAddress, isSigner: false, isWritable: false },
      { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      {
        pubkey: web3.SYSVAR_RENT_PUBKEY,
        isSigner: false,
        isWritable: false,
      },
    ];
    return new web3.TransactionInstruction({
      keys,
      programId: SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID,
      data: Buffer.from([]),
    });
  }

  async function mintToken() {
    isMinting = true;
    const mint = web3.Keypair.generate();
    const { tokenMint, gatekeeper, whitelistMintSettings, price, treasury } =
      $candyMachineData.state;
    const program = $candyMachineData.program;

    const userTokenAccountAddress = (
      await getAtaForMint(mint.publicKey, walletAddress.publicKey)
    )[0];

    const userPayingAccountAddress = tokenMint
      ? (await getAtaForMint(tokenMint, walletAddress.publicKey))[0]
      : walletAddress.publicKey;

    const candyMachineAddress = $candyMachineData.id;
    const remainingAccounts = [];
    const signers = [mint];
    const cleanupInstructions = [];
    const instructions = [
      web3.SystemProgram.createAccount({
        fromPubkey: walletAddress.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MintLayout.span,
        lamports:
          await program.provider.connection.getMinimumBalanceForRentExemption(
            MintLayout.span
          ),
        programId: TOKEN_PROGRAM_ID,
      }),
      Token.createInitMintInstruction(
        TOKEN_PROGRAM_ID,
        mint.publicKey,
        0,
        walletAddress.publicKey,
        walletAddress.publicKey
      ),
      createAssociatedTokenAccountInstruction(
        userTokenAccountAddress,
        walletAddress.publicKey,
        walletAddress.publicKey,
        mint.publicKey
      ),
      Token.createMintToInstruction(
        TOKEN_PROGRAM_ID,
        mint.publicKey,
        userTokenAccountAddress,
        walletAddress.publicKey,
        [],
        1
      ),
    ];

    if (gatekeeper) {
      remainingAccounts.push({
        pubkey: (
          await getNetworkToken(
            walletAddress.publicKey,
            gatekeeper.gatekeeperNetwork
          )
        )[0],
        isWritable: true,
        isSigner: false,
      });
      if (gatekeeper.expireOnUse) {
        remainingAccounts.push({
          pubkey: CIVIC,
          isWritable: false,
          isSigner: false,
        });
        remainingAccounts.push({
          pubkey: (await getNetworkExpire(gatekeeper.gatekeeperNetwork))[0],
          isWritable: false,
          isSigner: false,
        });
      }
    }

    if (whitelistMintSettings) {
      const mint = new web3.PublicKey(whitelistMintSettings.mint);

      const whitelistToken = (
        await getAtaForMint(mint, walletAddress.publicKey)
      )[0];
      remainingAccounts.push({
        pubkey: whitelistToken,
        isWritable: true,
        isSigner: false,
      });

      if (whitelistMintSettings.mode.burnEveryTime) {
        const whitelistBurnAuthority = web3.Keypair.generate();

        remainingAccounts.push({
          pubkey: mint,
          isWritable: true,
          isSigner: false,
        });
        remainingAccounts.push({
          pubkey: whitelistBurnAuthority.publicKey,
          isWritable: false,
          isSigner: true,
        });
        signers.push(whitelistBurnAuthority);
        const exists = await program.provider.connection.getAccountInfo(
          whitelistToken
        );
        if (exists) {
          instructions.push(
            Token.createApproveInstruction(
              TOKEN_PROGRAM_ID,
              whitelistToken,
              whitelistBurnAuthority.publicKey,
              walletAddress.publicKey,
              [],
              1
            )
          );
          cleanupInstructions.push(
            Token.createRevokeInstruction(
              TOKEN_PROGRAM_ID,
              whitelistToken,
              walletAddress.publicKey,
              []
            )
          );
        }
      }
    }

    if (tokenMint) {
      const transferAuthority = web3.Keypair.generate();

      signers.push(transferAuthority);
      remainingAccounts.push({
        pubkey: userPayingAccountAddress,
        isWritable: true,
        isSigner: false,
      });
      remainingAccounts.push({
        pubkey: transferAuthority.publicKey,
        isWritable: false,
        isSigner: true,
      });

      instructions.push(
        Token.createApproveInstruction(
          TOKEN_PROGRAM_ID,
          userPayingAccountAddress,
          transferAuthority.publicKey,
          walletAddress.publicKey,
          [],
          price.toNumber()
        )
      );
      cleanupInstructions.push(
        Token.createRevokeInstruction(
          TOKEN_PROGRAM_ID,
          userPayingAccountAddress,
          walletAddress.publicKey,
          []
        )
      );
    }
    const metadataAddress = await getMetadata(mint.publicKey);
    const masterEdition = await getMasterEdition(mint.publicKey);

    const [candyMachineCreator, creatorBump] = await getCandyMachineCreator(
      candyMachineAddress
    );

    instructions.push(
      await program.instruction.mintNft(creatorBump, {
        accounts: {
          candyMachine: candyMachineAddress,
          candyMachineCreator,
          payer: walletAddress.publicKey,
          wallet: treasury,
          mint: mint.publicKey,
          metadata: metadataAddress,
          masterEdition,
          mintAuthority: walletAddress.publicKey,
          updateAuthority: walletAddress.publicKey,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
          clock: web3.SYSVAR_CLOCK_PUBKEY,
          recentBlockhashes: web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
          instructionSysvarAccount: web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        },
        remainingAccounts:
          remainingAccounts.length > 0 ? remainingAccounts : undefined,
      })
    );

    try {
      const sent = await sendTransactions(
        program.provider.connection,
        program.provider.wallet,
        [instructions, cleanupInstructions],
        [signers, []]
      );
      console.log("sent", sent);
      const sentTransactions = sent.txs.map((t) => t.txid);
      console.log("sentTransactions", sentTransactions);

      isMinting = false;
      return sentTransactions;
    } catch (error) {
      isMinting = false;

      let message = error.msg || "Minting failed! Please try again!";

      if (!error.msg) {
        if (error.message.indexOf("0x138")) {
        } else if (error.message.indexOf("0x137")) {
          message = `SOLD OUT!`;
        } else if (error.message.indexOf("0x135")) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`;
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        }
      }

      console.warn(message);
    }

    isMinting = false;
    return [];
  }

  onMount(() => {
    getCandyMachineState();
  });
</script>

<div class="machine-container">
  {#if $candyMachineData?.state?.itemsAvailable}
    <div class="box">
      <CountdownTimer
        goLiveData={$candyMachineData.state.goLiveData}
        goLiveDateTimeString={$candyMachineData.state.goLiveDateTimeString}
      />
      <p>🍬 <span class="label">Items Minted</span> 🍬</p>
      <p class="data">
        {$candyMachineData?.state.itemsRedeemed} / {$candyMachineData?.state
          ?.itemsAvailable}
      </p>
    </div>
    {#if $candyMachineData?.state.itemsRedeemed === $candyMachineData?.state.itemsAvailable}
      <p class="sub-text">Sold Out!</p>
    {:else}
      <button
        class="cta-button mint-button"
        on:click={mintToken}
        disabled={isMinting}
      >
        {isMinting ? "Minting..." : "Mint NFT"}
      </button>
    {/if}
  {/if}
</div>
