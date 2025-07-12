import { Address, toNano } from '@ton/core';
import { PushEscrow, createDefaultPushEscrowConfig } from '../wrappers/PushEscrow';
import { compile, NetworkProvider } from '@ton/blueprint';
import { OpenedContract } from '@ton/core/dist/contract/openContract';
import { JettonMaster } from '@ton/ton';

// Authorized jetton master addresses
export const JETTON_MASTERS = {
  USDT: Address.parse('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'),
  MY: Address.parse('EQCFVNlRb-NHHDQfv3Q9xvDXBLJlay855_xREsq5ZDX6KN-w'),
};

export async function run(provider: NetworkProvider) {
  // Use the deployer address as the sudoer
  const sudoerAddress = provider.sender().address;
  if (!sudoerAddress) {
    throw new Error('Deployer address is required');
  }
  
  const pushEscrow = provider.open(
    PushEscrow.createFromConfig(
      createDefaultPushEscrowConfig(sudoerAddress),
      await compile('PushEscrow'),
    ),
  );

  await pushEscrow.sendDeploy(provider.sender(), toNano('0.05'));
  await provider.waitForDeploy(pushEscrow.address);

  await setAcl(provider, pushEscrow, sudoerAddress);
}

async function setAcl(
  provider: NetworkProvider,
  pushEscrow: OpenedContract<PushEscrow>,
  sudoerAddress: Address,
) {
  const usdtMaster = provider.open(JettonMaster.create(JETTON_MASTERS.USDT));
  const usdtJettonWalletAddress = await usdtMaster.getWalletAddress(pushEscrow.address);

  const myMaster = provider.open(JettonMaster.create(JETTON_MASTERS.MY));
  const myJettonWalletAddress = await myMaster.getWalletAddress(pushEscrow.address);

  console.log('USDT Wallet Address', usdtJettonWalletAddress);
  console.log('MY Wallet Address', myJettonWalletAddress);

  // Send the set ACL message
  const result = await pushEscrow.sendSetAcl(provider.sender(), {
    sudoer: sudoerAddress,
    usdtJettonWallet: usdtJettonWalletAddress,
    myJettonWallet: myJettonWalletAddress,
    value: toNano('0.01'), // Gas for the internal message
  });

  console.log(result);
}
