import {
  Storage,
  resetStorage,
  setDeployContext,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  bytesToString,
  stringToBytes,
  bytesToU64,
  bytesToI32,
  bytesToU32,
  u64ToBytes,
} from '@massalabs/as-types';
import {
  constructor,
  nft1_name,
  nft1_symbol,
  nft1_tokenURI,
  nft1_baseURI,
  nft1_totalSupply,
  nft1_mint,
  nft1_currentSupply,
  nft1_setURI,
  nft1_ownerOf,
  counterKey,
  initCounter,
  nft1_getApproved,
  nft1_approve,
  nft1_transferFrom,
  nft1_setApprovalForAll,
  nft1_isApprovedForAll,
} from '../NFT';
import { _increment, _updateBalanceOf } from '../NFT-internals';

const callerAddress = 'A12UBnqTHDQALpocVBnkPNy7y5CndUJQTLutaVDDFgMJcq5kQiKq';

const NFTName = 'MASSA_NFT';
const NFTSymbol = 'NFT';
const NFTBaseURI = 'my.massa/';
const NFTtotalSupply: u64 = 5;

describe('NFT contract', () => {
  beforeAll(() => {
    resetStorage();
    setDeployContext(callerAddress);
    constructor(
      new Args()
        .add(NFTName)
        .add(NFTSymbol)
        .add(NFTtotalSupply)
        .add(NFTBaseURI)
        .serialize(),
    );
  });

  test('initialized', () => {
    expect(bytesToU64(Storage.get(counterKey))).toBe(initCounter);
  });

  test('get name', () => {
    expect(bytesToString(nft1_name())).toBe(NFTName);
  });
  test('get symbol', () => {
    expect(bytesToString(nft1_symbol())).toBe(NFTSymbol);
  });
  test('totalSupply call', () => {
    expect(bytesToU64(nft1_totalSupply())).toBe(NFTtotalSupply);
  });
  test('get baseURI', () => {
    expect(bytesToString(nft1_baseURI())).toBe(NFTBaseURI);
  });

  test('get current supply', () => {
    expect(bytesToU64(nft1_currentSupply())).toBe(0);
  });

  test('get tokenURI', () => {
    const tokenID = 1;
    expect(
      bytesToString(nft1_tokenURI(new Args().add<u64>(tokenID).serialize())),
    ).toBe('my.massa/1');
  });

  test('set URI', () => {
    const newURI = 'my.newMassaURI/';
    const tokenID = 1;
    nft1_setURI(new Args().add(newURI).serialize());
    expect(
      bytesToString(nft1_tokenURI(new Args().add<u64>(tokenID).serialize())),
    ).toBe('my.newMassaURI/1');
  });

  test('mint call, ownerOf and currentSupply call', () => {
    expect(bytesToU64(nft1_currentSupply())).toBe(0);
    for (let i: u64 = 0; i < NFTtotalSupply; i++) {
      nft1_mint(new Args().add(callerAddress).serialize());
    }
    expect(Storage.get(counterKey)).toStrictEqual(u64ToBytes(NFTtotalSupply));
    expect(bytesToU64(nft1_currentSupply())).toBe(NFTtotalSupply);
    expect(nft1_ownerOf(new Args().add<u64>(2).serialize())).toStrictEqual(
      stringToBytes(callerAddress),
    );
  });

  throws('we have reach max supply', () => {
    nft1_mint(new Args().add(callerAddress).serialize());
  });

  test('current supply call', () => {
    expect(bytesToU64(nft1_currentSupply())).toBe(NFTtotalSupply);
  });

  test('approval', () => {
    const tokenId = 1;

    let address = '2x';
    approveAddress(tokenId, address);
    let approvedAddress = getAllowedAddress(tokenId);
    expect(approvedAddress).toStrictEqual(address);

    address = '3x';
    approveAddress(tokenId, address);
    approvedAddress = getAllowedAddress(tokenId);
    expect(approvedAddress).toStrictEqual(address);
  });

  test('approval for all', () => {
    const address = '2x';
    const recipient = '3x';
    const isApprovedForAll = true;

    nft1_setApprovalForAll(
      new Args().add(address).add(isApprovedForAll).serialize(),
    );

    expect(
      bytesToU32(
        nft1_isApprovedForAll(
          new Args().add(callerAddress).add(address).serialize(),
        ),
      ),
    ).toBe(1);

    nft1_transferFrom(
      new Args().add(callerAddress).add(recipient).add<u64>(1).serialize(),
    );

    expect(nft1_ownerOf(new Args().add<u64>(1).serialize())).toStrictEqual(
      stringToBytes(recipient),
    );

    expect(
      bytesToI32(
        nft1_isApprovedForAll(
          new Args().add(recipient).add(address).serialize(),
        ),
      ),
    ).toBe(0);
  });

  test('transferFrom', () => {
    const tokenId = 3;
    let address = '2x';
    let recipient = '3x';

    approveAddress(tokenId, address);
    expect(getAllowedAddress(tokenId)).toStrictEqual(address);
    let approvedAddress = getAllowedAddress(tokenId);

    expect(approvedAddress).toStrictEqual(address);

    nft1_transferFrom(
      new Args()
        .add(callerAddress)
        .add(recipient)
        .add<u64>(tokenId)
        .serialize(),
    );
    expect(isAllowanceCleared(tokenId)).toBeTruthy();
    expect(nft1_ownerOf(u64ToBytes(tokenId))).toStrictEqual(
      stringToBytes(recipient),
    );
  });

  throws('transferFrom fail if not allowed', () => {
    const tokenId = 4;
    expect(getAllowedAddress(tokenId)).toStrictEqual('');
    expect(nft1_ownerOf(u64ToBytes(tokenId))).toStrictEqual(
      stringToBytes(callerAddress),
    );

    nft1_transferFrom(new Args().add('2x').add('3x').add(4).serialize());
  });
});

function isAllowanceCleared(tokenId: u64): boolean {
  return getAllowedAddress(tokenId).length === 0;
}

function getAllowedAddress(tokenId: u64): string {
  const allowedAddress = bytesToString(
    nft1_getApproved(new Args().add(tokenId).serialize()),
  );

  return allowedAddress;
}

function approveAddress(tokenId: u64, address: string): void {
  const args = new Args().add(tokenId).add(address).serialize();
  nft1_approve(args);
}
describe('NFT internal', () => {
  describe('_increment function', () => {
    throws('should throw an error when overflow occurs', () => {
      // Set the counter to its maximum value
      const maxU64: u64 = u64.MAX_VALUE;
      Storage.set(counterKey, u64ToBytes(maxU64));

      // Expect an error to be thrown when trying to increment beyond the maximum value
      _increment();
    });

    test('should increment the counter', () => {
      // Set the counter to 0
      Storage.set(counterKey, u64ToBytes(0));

      // Expect the counter to be incremented
      expect(_increment()).toBe(1);
      const result = Storage.get(counterKey);
      expect(result).toStrictEqual(u64ToBytes(1));
    });
  });

  describe('_updateBalanceOf function', () => {
    it('should throw an error when overflow occurs', () => {
      const maxU64 = u64.MAX_VALUE;
      const balanceKey = stringToBytes('balanceOf_testAddress');
      Storage.set(balanceKey, u64ToBytes(maxU64));

      expect(() => _updateBalanceOf('testAddress', true)).toThrow();
    });

    it('should throw an error when underflow occurs', () => {
      const balanceKey = stringToBytes('balanceOf_testAddress');
      Storage.set(balanceKey, u64ToBytes(0));

      expect(() => _updateBalanceOf('testAddress', false)).toThrow();
    });

    it('should correctly increment the balance', () => {
      const balanceKey = stringToBytes('balanceOf_testAddress');
      Storage.set(balanceKey, u64ToBytes(10));

      _updateBalanceOf('testAddress', true);
      const newBalance = bytesToU64(Storage.get(balanceKey));
      expect(newBalance).toBe(11);
    });

    it('should correctly decrement the balance', () => {
      const balanceKey = stringToBytes('balanceOf_testAddress');
      Storage.set(balanceKey, u64ToBytes(10));

      _updateBalanceOf('testAddress', false);
      const newBalance = bytesToU64(Storage.get(balanceKey));
      expect(newBalance).toBe(9);
    });
  });
});
