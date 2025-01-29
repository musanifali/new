import { ethers } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { NFTWithCollections } from "../typechain-types";

describe("NFTWithCollections Contract", () => {
  let nftContract: NFTWithCollections;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  const NAME = "MyNFT";
  const SYMBOL = "MNFT";
  
  beforeEach(async () => {
    [owner, addr1, addr2] = await ethers.getSigners();
    const NFTWithCollections = await ethers.getContractFactory("NFTWithCollections");
    nftContract = await NFTWithCollections.deploy(NAME, SYMBOL);
    await nftContract.waitForDeployment();
  });

  describe("Deployment", () => {
    it("Should set correct name and symbol", async () => {
      expect(await nftContract.name()).to.equal(NAME);
      expect(await nftContract.symbol()).to.equal(SYMBOL);
    });
  });

  describe("Collection Creation", () => {
    it("Should create unique collection IDs", async () => {
      const collectionName = "Test Collection";
      const tx1 = await nftContract.createCollection(collectionName);
      await tx1.wait();
      
      const tx2 = await nftContract.createCollection(collectionName);
      await tx2.wait();
      
      const collectionId1 = (await nftContract.nextCollectionId()).toString();
      const tx3 = await nftContract.createCollection(collectionName);
      await tx3.wait();
      const collectionId2 = (await nftContract.nextCollectionId()).toString();
      
      expect(collectionId1).to.not.equal(collectionId2);
    });
  });

  describe("Minting NFTs", () => {
    let collectionId: string;

    beforeEach(async () => {
      const tx = await nftContract.createCollection("Test Collection");
      await tx.wait();
      collectionId = (await nftContract.nextCollectionId()).toString();
    });

    it("Should emit NFTMinted event", async () => {
      const metadataURI = "https://example.com/metadata/1";
      
      await expect(nftContract.mintWithRandomId(collectionId, metadataURI))
        .to.emit(nftContract, "NFTMinted")
        .withArgs(
          owner.address,
          (tokenId: bigint) => tokenId !== BigInt(0),
          collectionId,
          metadataURI
        );
    });

    it("Should mint NFT with random ID", async () => {
      const metadataURI = "https://example.com/metadata/1";
      const tx = await nftContract.mintWithRandomId(collectionId, metadataURI);
      await tx.wait();

      const [tokenIds, nftDetails] = await nftContract.getNFTsInCollection(collectionId);
      
      expect(tokenIds.length).to.equal(1);
      expect(nftDetails[0].metadataURI).to.equal(metadataURI);
    });

    it("Should prevent minting with empty metadata", async () => {
      await expect(nftContract.mintWithRandomId(collectionId, ""))
        .to.be.revertedWith("Metadata URI cannot be empty");
    });

    it("Should prevent minting by non-collection owner", async () => {
      const metadataURI = "https://example.com/metadata/1";
      await expect(
        nftContract.connect(addr1).mintWithRandomId(collectionId, metadataURI)
      ).to.be.revertedWith("Not the collection owner");
    });
  });

  describe("NFT Retrieval", () => {
    it("Should retrieve NFTs by owner", async () => {
      const collectionName = "Test Collection";
      const tx = await nftContract.createCollection(collectionName);
      await tx.wait();
      const collectionId = (await nftContract.nextCollectionId()).toString();

      const metadataURI = "https://example.com/metadata/1";
      await nftContract.mintWithRandomId(collectionId, metadataURI);

      const [tokens, count] = await nftContract.getNFTsByOwner(owner.address);
      
      expect(count).to.equal(1);
      expect(tokens.length).to.equal(1);
    });

    it("Should get NFT details", async () => {
      const collectionName = "Test Collection";
      const tx = await nftContract.createCollection(collectionName);
      await tx.wait();
      const collectionId = (await nftContract.nextCollectionId()).toString();

      const metadataURI = "https://example.com/metadata/1";
      await nftContract.mintWithRandomId(collectionId, metadataURI);

      const [tokenIds] = await nftContract.getNFTsInCollection(collectionId);
      const nftDetail = await nftContract.getNFTDetail(tokenIds[0]);

      expect(nftDetail.metadataURI).to.equal(metadataURI);
      expect(nftDetail.collectionId.toString()).to.equal(collectionId);
    });
  });
});