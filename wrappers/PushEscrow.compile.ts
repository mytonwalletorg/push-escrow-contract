import fs from 'fs';
import { CompilerConfig } from '@ton/blueprint';

const PROD_BOT_ID = '5230716013';
const PROD_TG_PK = '0xe7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d';

const TEST_BOT_ID = '5000944665';
const TEST_TG_PK = '0x40055058a4ee38156a06562e52eece92a771bcd8346a8c4615cb7376eddf72ec';

export const compile: CompilerConfig = {
  lang: 'func',
  targets: ['contracts/push_escrow.fc'],

  async preCompileHook(params) {
    if (process.env.NODE_ENV === 'test') {
      const prodCode = fs.readFileSync('contracts/push_escrow.fc', 'utf8');

      const testCode = prodCode
        .replace(PROD_BOT_ID, TEST_BOT_ID)
        .replace(PROD_TG_PK, TEST_TG_PK);

      fs.writeFileSync('contracts/push_escrow.fc', testCode, 'utf8');
    }
  },

  async postCompileHook(params) {
    if (process.env.NODE_ENV === 'test') {
      const testCode = fs.readFileSync('contracts/push_escrow.fc', 'utf8');
      const prodCode = testCode
        .replace(TEST_BOT_ID, PROD_BOT_ID)
        .replace(TEST_TG_PK, PROD_TG_PK);

      fs.writeFileSync('contracts/push_escrow.fc', prodCode);
    }
  },
};
