import { Address, BigInt } from '@graphprotocol/graph-ts';
import { Creator, Protocol } from '../../generated/schema';

export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);
export const PROTOCOL_ID = 'gemfot';

export function getOrCreateProtocol(): Protocol {
  let protocol = Protocol.load(PROTOCOL_ID);
  if (protocol == null) {
    protocol = new Protocol(PROTOCOL_ID);
    protocol.launchCount = ZERO_BI;
    protocol.totalRevenue = ZERO_BI;
    protocol.totalBuys = ZERO_BI;
    protocol.save();
  }
  return protocol as Protocol;
}

export function getOrCreateCreator(address: Address): Creator {
  let id = address.toHexString();
  let creator = Creator.load(id);
  if (creator == null) {
    creator = new Creator(id);
    creator.launchCount = ZERO_BI;
    creator.totalRevenue = ZERO_BI;
    creator.save();
  }
  return creator as Creator;
}
