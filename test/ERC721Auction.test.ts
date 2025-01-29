import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ERC721Auction, NFTWithCollections } from "../typechain-types";

describe("ERC721Auction Contract", () => {
  let auction: ERC721Auction;
  let nftContract: NFTWithCollections;
  let owner: SignerWithAddress;
  let seller: SignerWithAddress;
  let bidder1: SignerWithAddress;
  let bidder2: SignerWithAddress;
  let addrs: SignerWithAddress[];
  
  const STARTING_BID = ethers.parseEther("1");
  const AUCTION_DURATION = 3600; // 1 hour in seconds

  beforeEach(async () => {
    // Deploy contracts
    [owner, seller, bidder1, bidder2, ...addrs] = await ethers.getSigners();
    
    // Deploy NFT contract
    const NFTContract = await ethers.getContractFactory("NFTWithCollections");
    nftContract = await NFTContract.deploy("Test NFT", "TNFT");
    await nftContract.waitForDeployment();

    // Deploy Auction contract
    const AuctionContract = await ethers.getContractFactory("ERC721Auction");
    auction = await AuctionContract.deploy();
    await auction.waitForDeployment();
  });

  describe("Auction Creation", () => {
    let tokenId: bigint;
    let collectionId: string;

    beforeEach(async () => {
      // Create collection and mint NFT for seller
      const tx = await nftContract.connect(seller).createCollection("Test Collection");
      await tx.wait();
      collectionId = (await nftContract.nextCollectionId()).toString();
      await nftContract.connect(seller).mintWithRandomId(collectionId, "testURI");
      tokenId = 1n;
    });

    it("Should create auction successfully", async () => {
      // Approve auction contract
      await nftContract.connect(seller).approve(await auction.getAddress(), tokenId);
      
      await expect(
        auction.connect(seller).createAuction(
          await nftContract.getAddress(),
          tokenId,
          STARTING_BID,
          AUCTION_DURATION
        )
      ).to.emit(auction, "AuctionCreated")
        .withArgs(tokenId, await nftContract.getAddress(), STARTING_BID, await ethers.provider.getBlock("latest").then(b => b!.timestamp + AUCTION_DURATION));
    });

    it("Should fail if not token owner", async () => {
      await expect(
        auction.connect(bidder1).createAuction(
          await nftContract.getAddress(),
          tokenId,
          STARTING_BID,
          AUCTION_DURATION
        )
      ).to.be.revertedWith("Only the owner can create an auction");
    });

    it("Should fail if starting bid is zero", async () => {
      await nftContract.connect(seller).approve(await auction.getAddress(), tokenId);
      
      await expect(
        auction.connect(seller).createAuction(
          await nftContract.getAddress(),
          tokenId,
          0,
          AUCTION_DURATION
        )
      ).to.be.revertedWith("Starting bid must be greater than zero");
    });

    it("Should fail if auction already exists", async () => {
      await nftContract.connect(seller).approve(await auction.getAddress(), tokenId);
      
      await auction.connect(seller).createAuction(
        await nftContract.getAddress(),
        tokenId,
        STARTING_BID,
        AUCTION_DURATION
      );

      await expect(
        auction.connect(seller).createAuction(
          await nftContract.getAddress(),
          tokenId,
          STARTING_BID,
          AUCTION_DURATION
        )
      ).to.be.revertedWith("Auction already exists for this token");
    });
  });

  describe("Bidding", () => {
    let tokenId: bigint;
    let auctionKey: string;

    beforeEach(async () => {
      // Setup: Create collection, mint NFT, and create auction
      const tx = await nftContract.connect(seller).createCollection("Test Collection");
      await tx.wait();
      const collectionId = (await nftContract.nextCollectionId()).toString();
      await nftContract.connect(seller).mintWithRandomId(collectionId, "testURI");
      tokenId = 1n;
      
      await nftContract.connect(seller).approve(await auction.getAddress(), tokenId);
      await auction.connect(seller).createAuction(
        await nftContract.getAddress(),
        tokenId,
        STARTING_BID,
        AUCTION_DURATION
      );
      
      auctionKey = await auction.getAuctionKey(await nftContract.getAddress(), tokenId);
    });

    it("Should place bid successfully", async () => {
      const bidAmount = STARTING_BID + ethers.parseEther("0.5");
      
      await expect(
        auction.connect(bidder1).placeBid(await nftContract.getAddress(), tokenId, { value: bidAmount })
      ).to.emit(auction, "BidPlaced")
        .withArgs(tokenId, await nftContract.getAddress(), bidder1.address, bidAmount);
    });

    it("Should refund previous bidder when new bid is placed", async () => {
      const bid1Amount = STARTING_BID + ethers.parseEther("0.5");
      const bid2Amount = STARTING_BID + ethers.parseEther("1");
      
      await auction.connect(bidder1).placeBid(await nftContract.getAddress(), tokenId, { value: bid1Amount });
      
      const initialBalance = await ethers.provider.getBalance(bidder1.address);
      await auction.connect(bidder2).placeBid(await nftContract.getAddress(), tokenId, { value: bid2Amount });
      
      const pendingWithdrawal = await auction.pendingWithdrawals(bidder1.address);
      expect(pendingWithdrawal).to.equal(bid1Amount);
    });

    it("Should fail if bid is below starting price", async () => {
      const lowBid = STARTING_BID - ethers.parseEther("0.5");
      
      await expect(
        auction.connect(bidder1).placeBid(await nftContract.getAddress(), tokenId, { value: lowBid })
      ).to.be.revertedWith("Bid must be at least the starting bid");
    });

    it("Should fail if bid is not higher than current bid", async () => {
      await auction.connect(bidder1).placeBid(await nftContract.getAddress(), tokenId, { value: STARTING_BID });
      
      await expect(
        auction.connect(bidder2).placeBid(await nftContract.getAddress(), tokenId, { value: STARTING_BID })
      ).to.be.revertedWith("Bid must be higher than the current highest bid");
    });
  });

  describe("Auction Finalization", () => {
    let tokenId: bigint;

    beforeEach(async () => {
      // Setup: Create collection, mint NFT, and create auction
      const tx = await nftContract.connect(seller).createCollection("Test Collection");
      await tx.wait();
      const collectionId = (await nftContract.nextCollectionId()).toString();
      await nftContract.connect(seller).mintWithRandomId(collectionId, "testURI");
      tokenId = 1n;
      
      await nftContract.connect(seller).approve(await auction.getAddress(), tokenId);
    });

    it("Should finalize auction with winning bid", async () => {
      // Create auction with short duration
      await auction.connect(seller).createAuction(
        await nftContract.getAddress(),
        tokenId,
        STARTING_BID,
        60 // 1 minute
      );

      // Place bid
      await auction.connect(bidder1).placeBid(
        await nftContract.getAddress(),
        tokenId,
        { value: STARTING_BID }
      );

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        auction.finalizeAuction(await nftContract.getAddress(), tokenId)
      ).to.emit(auction, "AuctionFinalized")
        .withArgs(tokenId, await nftContract.getAddress(), bidder1.address, STARTING_BID);
    });

    it("Should return NFT to seller if no bids", async () => {
      await auction.connect(seller).createAuction(
        await nftContract.getAddress(),
        tokenId,
        STARTING_BID,
        60
      );

      await ethers.provider.send("evm_increaseTime", [61]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        auction.finalizeAuction(await nftContract.getAddress(), tokenId)
      ).to.emit(auction, "AuctionFinalized")
        .withArgs(tokenId, await nftContract.getAddress(), seller.address, 0);
    });

    it("Should fail if auction hasn't ended", async () => {
      await auction.connect(seller).createAuction(
        await nftContract.getAddress(),
        tokenId,
        STARTING_BID,
        AUCTION_DURATION
      );

      await expect(
        auction.finalizeAuction(await nftContract.getAddress(), tokenId)
      ).to.be.revertedWith("Auction has not ended");
    });
  });

  describe("Auction Cancellation", () => {
    let tokenId: bigint;

    beforeEach(async () => {
      // Setup: Create collection, mint NFT, and create auction
      const tx = await nftContract.connect(seller).createCollection("Test Collection");
      await tx.wait();
      const collectionId = (await nftContract.nextCollectionId()).toString();
      await nftContract.connect(seller).mintWithRandomId(collectionId, "testURI");
      tokenId = 1n;
      
      await nftContract.connect(seller).approve(await auction.getAddress(), tokenId);
      await auction.connect(seller).createAuction(
        await nftContract.getAddress(),
        tokenId,
        STARTING_BID,
        AUCTION_DURATION
      );
    });

    it("Should cancel auction with no bids", async () => {
      await expect(
        auction.connect(seller).cancelAuction(await nftContract.getAddress(), tokenId)
      ).to.emit(auction, "AuctionCancelled")
        .withArgs(tokenId, await nftContract.getAddress());
    });

    it("Should fail if not seller", async () => {
      await expect(
        auction.connect(bidder1).cancelAuction(await nftContract.getAddress(), tokenId)
      ).to.be.revertedWith("Only the seller can cancel the auction");
    });

    it("Should fail if auction has bids", async () => {
      await auction.connect(bidder1).placeBid(
        await nftContract.getAddress(),
        tokenId,
        { value: STARTING_BID }
      );

      await expect(
        auction.connect(seller).cancelAuction(await nftContract.getAddress(), tokenId)
      ).to.be.revertedWith("Cannot cancel auction with bids");
    });
  });

  describe("Withdrawal", () => {
    let tokenId: bigint;

    beforeEach(async () => {
      // Setup: Create collection, mint NFT, and create auction with bids
      const tx = await nftContract.connect(seller).createCollection("Test Collection");
      await tx.wait();
      const collectionId = (await nftContract.nextCollectionId()).toString();
      await nftContract.connect(seller).mintWithRandomId(collectionId, "testURI");
      tokenId = 1n;
      
      await nftContract.connect(seller).approve(await auction.getAddress(), tokenId);
      await auction.connect(seller).createAuction(
        await nftContract.getAddress(),
        tokenId,
        STARTING_BID,
        AUCTION_DURATION
      );
    });

    it("Should allow withdrawal of funds", async () => {
      // Place initial bid
      await auction.connect(bidder1).placeBid(
        await nftContract.getAddress(),
        tokenId,
        { value: STARTING_BID }
      );

      // Place higher bid to create pending withdrawal
      await auction.connect(bidder2).placeBid(
        await nftContract.getAddress(),
        tokenId,
        { value: STARTING_BID + ethers.parseEther("0.5") }
      );

      const initialBalance = await ethers.provider.getBalance(bidder1.address);
      await auction.connect(bidder1).withdrawFunds();
      const finalBalance = await ethers.provider.getBalance(bidder1.address);

      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("Should fail if no funds to withdraw", async () => {
      await expect(
        auction.connect(bidder1).withdrawFunds()
      ).to.be.revertedWith("No funds to withdraw");
    });
  });
});