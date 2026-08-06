import { BigInt } from '@graphprotocol/graph-ts';
import {
  FairLaunchCreated,
  FairLaunchBought,
  FairLaunchEnded,
} from '../../generated/FairLaunch/FairLaunch';
import { FairLaunchBuy, Launch } from '../../generated/schema';
import { getOrCreateProtocol, ONE_BI, ZERO_BI } from '../utils/entities';

export function handleFairLaunchCreated(event: FairLaunchCreated): void {
  let launch = Launch.load(event.params._poolId.toHexString());
  if (launch == null) return;

  launch.fairLaunchStartsAt = event.params._startsAt;
  launch.fairLaunchEndsAt = event.params._endsAt;
  launch.initialTokenFairLaunch = event.params._tokens;
  launch.remainingSupply = event.params._tokens;
  launch.fairLaunchClosed = false;
  launch.save();
}

export function handleFairLaunchBought(event: FairLaunchBought): void {
  let launchId = event.params._poolId.toHexString();
  let launch = Launch.load(launchId);
  if (launch == null) return;

  // `_sold` is the cumulative amount of tokens sold on the curve
  let sold = event.params._sold;
  let remaining = launch.initialTokenFairLaunch.minus(sold);
  if (remaining.lt(ZERO_BI)) remaining = ZERO_BI;

  let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let buy = new FairLaunchBuy(id);
  buy.launch = launch.id;
  buy.buyer = event.transaction.from;
  buy.nativeIn = event.params._nativeIn;
  buy.tokensOut = event.params._tokensOut;
  buy.totalSold = sold;
  buy.timestamp = event.block.timestamp;
  buy.blockNumber = event.block.number;
  buy.transactionHash = event.transaction.hash;
  buy.save();

  launch.soldSupply = sold;
  launch.remainingSupply = remaining;
  launch.revenue = launch.revenue.plus(event.params._nativeIn);
  launch.buyCount = launch.buyCount.plus(ONE_BI);
  launch.save();

  let protocol = getOrCreateProtocol();
  protocol.totalRevenue = protocol.totalRevenue.plus(event.params._nativeIn);
  protocol.totalBuys = protocol.totalBuys.plus(ONE_BI);
  protocol.save();
}

export function handleFairLaunchEnded(event: FairLaunchEnded): void {
  let launch = Launch.load(event.params._poolId.toHexString());
  if (launch == null) return;

  launch.fairLaunchClosed = true;
  launch.fairLaunchEndsAt = event.params._endedAt;
  launch.revenue = event.params._revenue;
  launch.remainingSupply = event.params._remainingSupply;
  launch.soldSupply = event.params._initialSupply.minus(event.params._remainingSupply);
  launch.save();
}

// keeps BigInt import used when compiled with strict settings
export function _unusedBigInt(): BigInt {
  return BigInt.fromI32(0);
}
