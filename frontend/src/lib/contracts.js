import { ethers } from "ethers";
import FactoryABI from "../abi/EscrowFactory.json";
import EscrowABI from "../abi/FreelanceEscrow.json";
import DisputeMultiSigABI from "../abi/DisputeMultiSig.json";
import { FACTORY_ADDRESS, MULTISIG_ADDRESS } from "../config";

export function getFactory(signer) {
  return new ethers.Contract(
    FACTORY_ADDRESS,
    FactoryABI.abi,
    signer
  );
}

export function getEscrow(address, signer) {
  return new ethers.Contract(
    address,
    EscrowABI.abi,
    signer
  );
}
export function getMultiSig(signerOrProvider) {
  return new ethers.Contract(
    MULTISIG_ADDRESS,
    DisputeMultiSigABI.abi,
    signerOrProvider
  );
}

