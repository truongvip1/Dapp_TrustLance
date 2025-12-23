import { ethers } from "ethers";
import FactoryABI from "../abi/EscrowFactory.json";
import EscrowABI from "../abi/FreelanceEscrow.json";
import { FACTORY_ADDRESS } from "../config";

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
