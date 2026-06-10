import { ethers } from "ethers";
import ABI from "../../abi/GreenTokenABI.json";

export const CONTRACT_ADDRESS = "0xf10d483eec352f3136e33ad87a1c53188fb400a6";

export const getContract = async () => {
  if (!window.ethereum) throw new Error("MetaMask not found");

  const provider = new ethers.BrowserProvider(window.ethereum);
  
  try {
    const network = await provider.getNetwork();
    const chainId = network.chainId;
    const SEPOLIA_CHAIN_ID = 11155111n;

    if (chainId !== SEPOLIA_CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0xaa36a7" }], // Sepolia chain ID in hex (11155111 = 0xaa36a7)
        });
        
        // Re-initialize provider and signer after switching network
        const updatedProvider = new ethers.BrowserProvider(window.ethereum);
        const signer = await updatedProvider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
        return { contract, signer, provider: updatedProvider };
      } catch (switchError) {
        // Code 4902 means the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: "0xaa36a7",
                  chainName: "Sepolia Test Network",
                  nativeCurrency: {
                    name: "Sepolia Ether",
                    symbol: "ETH",
                    decimals: 18,
                  },
                  rpcUrls: ["https://rpc.sepolia.org"],
                  blockExplorerUrls: ["https://sepolia.etherscan.io"],
                },
              ],
            });
            const updatedProvider = new ethers.BrowserProvider(window.ethereum);
            const signer = await updatedProvider.getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
            return { contract, signer, provider: updatedProvider };
          } catch (addError) {
            console.warn("Failed to add Sepolia network to MetaMask:", addError);
          }
        } else {
          console.warn("User declined or failed to switch to Sepolia network:", switchError);
        }
      }
    }
  } catch (networkError) {
    console.warn("Error checking or switching network:", networkError);
  }

  const signer = await provider.getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  return { contract, signer, provider };
};