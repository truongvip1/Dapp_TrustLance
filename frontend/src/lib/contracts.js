import { ethers } from "ethers";
import FactoryABI from "../abi/EscrowFactory.json";
import EscrowABI from "../abi/FreelanceEscrow.json";
import DisputeMultiSigABI from "../abi/DisputeMultiSig.json";
import { FACTORY_ADDRESS, MULTISIG_ADDRESS } from "../config";

/**
 * Factory – write
 */
export function getFactory(signer) {
  return new ethers.Contract(
    FACTORY_ADDRESS,
    FactoryABI.abi,
    signer
  );
}

/**
 * Escrow – read OR write
 * @param address escrow address
 * @param runner  signer | provider
 */
export function getEscrow(address, runner) {
  return new ethers.Contract(
    address,
    EscrowABI.abi,
    runner
  );
}

/**
 * Multisig – read OR write
 */
export function getMultiSig(runner) {
  return new ethers.Contract(
    MULTISIG_ADDRESS,
    DisputeMultiSigABI.abi,
    runner
  );
}
