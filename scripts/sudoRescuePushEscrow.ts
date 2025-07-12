import { Address, beginCell, toNano } from '@ton/core';
import { PushEscrow } from '../wrappers/PushEscrow';
import { NetworkProvider } from '@ton/blueprint';
import { JettonMaster } from '@ton/ton';

// Authorized jetton master addresses
export const JETTON_MASTERS = {
  USDT: Address.parse('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'),
  MY: Address.parse('EQCFVNlRb-NHHDQfv3Q9xvDXBLJlay855_xREsq5ZDX6KN-w'),
};

// Jetton decimals
const JETTON_DECIMALS = {
  TON: 9,
  USDT: 6,
  MY: 9,
};

export async function run(provider: NetworkProvider) {
  const args = process.argv.slice(4); // Skip 'run' and 'sudoRescuePushEscrow'

  if (args.length !== 3) {
    console.log('Usage: npx blueprint run sudoRescuePushEscrow <contract_address> <amount> <ticker>');
    console.log('Example: npx blueprint run sudoRescuePushEscrow EQC... 1.5 USDT');
    console.log('Supported tickers: TON, USDT, MY');
    return;
  }

  const [contractAddressStr, amountStr, ticker] = args;
  
  // Validate inputs
  const contractAddress = Address.parse(contractAddressStr);
  const amount = parseFloat(amountStr);
  
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }
  
  if (!['TON', 'USDT', 'MY'].includes(ticker)) {
    throw new Error('Ticker must be one of: TON, USDT, MY');
  }

  // Get sudoer address
  const sudoerAddress = provider.sender().address;
  if (!sudoerAddress) {
    throw new Error('Sudoer address is required');
  }

  const pushEscrow = provider.open(PushEscrow.createFromAddress(contractAddress));

  console.log(`Rescuing ${amount} ${ticker} from contract ${contractAddress} to sudoer ${sudoerAddress}`);

  if (ticker === 'TON') {
    await rescueTon(provider, pushEscrow, sudoerAddress, amount);
  } else {
    await rescueJetton(provider, pushEscrow, sudoerAddress, amount, ticker as 'USDT' | 'MY');
  }
}

async function rescueTon(
  provider: NetworkProvider,
  pushEscrow: any,
  sudoerAddress: Address,
  amount: number,
) {
  const amountNano = toNano(amount.toString());
  
  // Create TON transfer message
  const transferMessage = beginCell()
    .storeUint(0x10, 6) // non-bounceable internal message
    .storeAddress(sudoerAddress)
    .storeCoins(amountNano)
    .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1) // empty message body
    .endCell();

  console.log(`Sending ${amount} TON to sudoer...`);

  const result = await pushEscrow.sendSudoerRequest(provider.sender(), {
    message: transferMessage,
    mode: 1, // ORDINARY mode
    value: toNano('0.01'), // Gas for the operation
  });

  console.log('TON rescue transaction sent:', result);
}

async function rescueJetton(
  provider: NetworkProvider,
  pushEscrow: any,
  sudoerAddress: Address,
  amount: number,
  ticker: 'USDT' | 'MY',
) {
  const decimals = JETTON_DECIMALS[ticker];
  const jettonAmount = BigInt(amount * Math.pow(10, decimals));
  
  // Get jetton master and derive wallet addresses
  const jettonMaster = provider.open(JettonMaster.create(JETTON_MASTERS[ticker]));
  const contractJettonWalletAddress = await jettonMaster.getWalletAddress(pushEscrow.address);

  console.log(`Contract ${ticker} wallet:`, contractJettonWalletAddress);
  console.log(`Sudoer wallet:`, sudoerAddress);

  // Create jetton transfer message body
  const jettonTransferBody = beginCell()
    .storeUint(0xf8a7ea5, 32) // op code for jetton transfer
    .storeUint(0, 64) // query_id
    .storeCoins(jettonAmount) // jetton amount to transfer
    .storeAddress(sudoerAddress) // destination (sudoer's jetton wallet)
    .storeAddress(sudoerAddress) // response_destination (for excess TON)
    .storeBit(0) // no custom payload
    .storeCoins(1n) // forward_ton_amount (1 nanoton for notification)
    .storeBit(0) // forward_payload inline (empty)
    .endCell();

  // Create the message to contract's jetton wallet
  const jettonTransferMessage = beginCell()
    .storeUint(0x18, 6) // bounceable internal message
    .storeAddress(contractJettonWalletAddress)
    .storeCoins(toNano('0.05')) // TON amount for jetton transfer fees
    .storeUint(1, 1 + 4 + 4 + 64 + 32 + 1 + 1) // message body as reference
    .storeRef(jettonTransferBody)
    .endCell();

  console.log(`Sending ${amount} ${ticker} to sudoer...`);

  const result = await pushEscrow.sendSudoerRequest(provider.sender(), {
    message: jettonTransferMessage,
    mode: 1, // ORDINARY mode
    value: toNano('0.1'), // Gas for the operation
  });

  console.log(`${ticker} rescue transaction sent:`, result);
} 