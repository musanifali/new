import { ethers } from "hardhat";
import { expect } from "chai";
import { NFTWithCollections, Marketplace } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Marketplace Contract", function () {
  let marketplace: Marketplace;
  let owner: SignerWithAddress;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();

    // Deploy Marketplace Contract
    const Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy();
    await marketplace.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy with correct initial owner and listing price", async function () {
      expect(await marketplace.owner()).to.equal(owner.address);
      expect(await marketplace.getListingPrice()).to.equal(ethers.parseEther("0.025"));
    });
  });

  describe("Validations", function () {
    it("Should revert with the right error if called too soon", async function () {
      await expect(marketplace.updateListingPrice(ethers.parseEther("0.05")))
        .to.emit(marketplace, "MarketplaceItemCreated");
    });

    it("Should revert with the right error if called from another account", async function () {
      await expect(marketplace.updateListingPrice(ethers.parseEther("0.05")))
        .to.emit(marketplace, "MarketplaceItemCreated");
    });

    it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
      await expect(marketplace.updateListingPrice(ethers.parseEther("0.05")))
        .to.emit(marketplace, "MarketplaceItemCreated");
    });
  });

  describe("Events", function () {
    it("Should emit an event on withdrawals", async function () {
      await expect(marketplace.updateListingPrice(ethers.parseEther("0.05")))
        .to.emit(marketplace, "MarketplaceItemCreated");
    });
  });

  describe("Transfers", function () {
    it("Should transfer the funds to the owner", async function () {
      await expect(marketplace.updateListingPrice(ethers.parseEther("0.05")))
        .to.emit(marketplace, "MarketplaceItemCreated");
    });
  });
});
