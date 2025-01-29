import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
      hardhat: {
        chainId: 1337,
      }, // Local Hardhat Network
      // sepolia: {
      //     url: "https://mainnet.infura.io/v3/5f92eb53cbaf4c65ac0b8072272f35fd", // Infura RPC endpoint
      //     accounts: ["53e0fa4969101bafc145adf4a58d2080579115b6d2a827fab6c9ed639e6526f0"], // Replace with your wallet private key
      // },
  },
};

export default config;
