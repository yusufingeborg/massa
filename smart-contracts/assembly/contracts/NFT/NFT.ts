import {
  Storage,
  Context,
  generateEvent,
  Address,
  createEvent,
} from '@massalabs/massa-as-sdk';
import {
  Args,
  stringToBytes,
  bytesToU64,
  u32ToBytes,
  u64ToBytes,
} from '@massalabs/as-types';
import {
  assertIsMinted,
  _onlyOwner,
  _currentSupply,
  _increment,
  _transfer,
  _approve,
  _getApproved,
  _setApprovalForAll,
  _isApprovedForAll,
  _updateBalanceOf,
  _getBalanceOf,
  assertIsOwner,
  _constructor,
} from './NFT-internals';

export const nameKey = 'name';
export const symbolKey = 'symbol';
export const totalSupplyKey = stringToBytes('totalSupply');
export const baseURIKey = 'baseURI';
export const tokenURIKey = 'tokenURI';
export const ownerKey = 'Owner';
export const counterKey = stringToBytes('Counter');
export const ownerTokenKey = 'ownerOf_';
export const approvedTokenKey = 'approved_';
export const approvedForAllTokenKey = 'approvedForAll_';
export const initCounter = 0;

/**
 * Constructor of the NFT contract
 * Can be called only once
 *
 * @remarks
 * Storage specification:
 * - 'name' =\> (string) the token name
 * - 'symbol' =\> (string) the token symbol
 * - 'totalSupply' =\> (StaticArray<u8>) the total supply
 * - 'baseURI' =\> (string) the base URI (must ends with '/')
 * - 'Owner' =\> (string) the owner address
 * - 'Counter' =\> (StaticArray<u8>) the current counter
 * - 'ownerOf_[token id]' =\> (string) the owner of the specified token id
 *
 * @example
 * ```typescript
 * constructor(
 *   new Args()
 *     .add(NFTName)
 *     .add(NFTSymbol)
 *     .add(NFTtotalSupply)
 *     .add(NFTBaseURI)
 *     .serialize(),
 *   );
 * ```
 *
 * @param binaryArgs - arguments serialized with `Args` containing the name, the symbol, the totalSupply as u64,
 * the baseURI
 */
export function constructor(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);
  _constructor(args);
}

/**
 * Change the base URI, can be only called by the contract Owner
 * @param binaryArgs - Serialized URI String with `Args`
 */
export function nft1_setURI(binaryArgs: StaticArray<u8>): void {
  assert(_onlyOwner(), 'The caller is not the owner of the contract');

  const args = new Args(binaryArgs);
  const newBaseURI = args
    .nextString()
    .expect('BaseURI argument is missing or invalid');

  Storage.set(baseURIKey, newBaseURI);
  generateEvent(createEvent('baseURI', [newBaseURI]));
}

// ======================================================== //
// ====                 TOKEN ATTRIBUTES               ==== //
// ======================================================== //

// Token attributes functions return a generateEvent when possible for more readability as we cannot return string

/**
 * Returns the NFT's name
 * @param _ - unused see https://github.com/massalabs/massa-sc-std/issues/18
 */
export function nft1_name(
  _: StaticArray<u8> = new StaticArray<u8>(0),
): StaticArray<u8> {
  return stringToBytes(Storage.get(nameKey));
}

/**
 * Returns the NFT's symbol
 * @param _ - unused see https://github.com/massalabs/massa-sc-std/issues/18
 */
export function nft1_symbol(
  _: StaticArray<u8> = new StaticArray<u8>(0),
): StaticArray<u8> {
  return stringToBytes(Storage.get(symbolKey));
}

/**
 * Returns the token URI (external link written in NFT where pictures or others are stored)
 * @param binaryArgs - u64 serialized tokenID with `Args`
 */
export function nft1_tokenURI(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tokenId = args
    .nextU64()
    .expect('token id argument is missing or invalid')
    .toString();

  const key = tokenURIKey + tokenId;
  if (Storage.has(key)) {
    return stringToBytes(Storage.get(key));
  } else {
    return stringToBytes(Storage.get(baseURIKey) + tokenId);
  }
}

/**
 * Set a token URI (external link written in NFT where pictures or others are stored).
 * If not set the tokenURI will be the baseURI + tokenId
 * @param binaryArgs - u64 serialized tokenID with `Args` + URI string
 */
export function nft1_setTokenURI(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);
  const tokenId = args
    .nextU64()
    .expect('token id argument is missing or invalid');

  assertIsMinted(tokenId);
  assertIsOwner(Context.caller().toString(), tokenId);

  Storage.set(
    tokenURIKey + tokenId.toString(),
    args.nextString().expect('tokenURI argument is missing or invalid'),
  );
}

/**
 * Returns the base URI
 * @param _ - unused see https://github.com/massalabs/massa-sc-std/issues/18
 */
export function nft1_baseURI(
  _: StaticArray<u8> = new StaticArray<u8>(0),
): StaticArray<u8> {
  return stringToBytes(Storage.get(baseURIKey));
}

/**
 * Returns the max supply possible
 * @param _ - unused see https://github.com/massalabs/massa-sc-std/issues/18
 * @returns the u64 max supply
 */
export function nft1_totalSupply(
  _: StaticArray<u8> = new StaticArray<u8>(0),
): StaticArray<u8> {
  return Storage.get(totalSupplyKey);
}

/**
 * Return the current supply.
 * @param _ - unused see https://github.com/massalabs/massa-sc-std/issues/18
 * @returns the u64 current counter
 */
export function nft1_currentSupply(
  _: StaticArray<u8> = new StaticArray<u8>(0),
): StaticArray<u8> {
  return Storage.get(counterKey);
}

/**
 * Return the tokenId's owner
 * @param _args - tokenId serialized with `Args` as u64
 * @returns serialized Address as string
 */
export function nft1_ownerOf(_args: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(_args);
  const tokenId = args
    .nextU64()
    .expect('tokenId argument is missing or invalid');

  assertIsMinted(tokenId);

  const key = ownerTokenKey + tokenId.toString();

  return stringToBytes(Storage.get(key));
}

/**
 * Return the balance of the address
 * @param _args - Address serialized with `Args`
 * @returns the balance as u64
 * @throws if the address is invalid
 */
export function nft1_balanceOf(_args: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(_args);
  const address = args
    .nextString()
    .expect('address argument is missing or invalid');

  return u64ToBytes(_getBalanceOf(address));
}

// ==================================================== //
// ====                    MINT                    ==== //
// ==================================================== //

/**
 * The argument's address becomes the owner of the next token (if current tokenID = 10, will mint the 11 )
 * Check if max supply is not reached
 * @param _args - Address as string serialized with `Args`
 */
export function nft1_mint(_args: StaticArray<u8>): void {
  assert(
    bytesToU64(Storage.get(totalSupplyKey)) > _currentSupply(),
    'Max supply reached',
  );

  const args = new Args(_args);

  const mintAddress = args
    .nextString()
    .expect('mintAddress argument is missing or invalid');

  const tokenToMint = _increment();

  const key = ownerTokenKey + tokenToMint.toString();

  Storage.set(key, mintAddress);

  _updateBalanceOf(mintAddress, true);

  generateEvent(createEvent('Mint', [mintAddress]));
}

// ==================================================== //
// ====                 TRANSFER                   ==== //
// ==================================================== //

/**
 * Transfer a chosen token from the from Address to the to Address.
 * First check that the token is minted and that the caller is allowed to transfer the token.
 * @param binaryArgs - arguments serialized with `Args` containing the following data in this order :
 * - the owner's account (address)
 * - the recipient's account (address)
 * - the tokenID (u64).
 * @throws if the token is not minted or if the caller is not allowed to transfer the token
 */
export function nft1_transferFrom(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);
  const caller = Context.caller().toString();
  const owner = args
    .nextString()
    .expect('fromAddress argument is missing or invalid');
  const recipient = args
    .nextString()
    .expect('toAddress argument is missing or invalid');
  const tokenId = args
    .nextU64()
    .expect('tokenId argument is missing or invalid');

  _transfer(caller, owner, recipient, tokenId);

  generateEvent(
    createEvent('TransferFrom', [tokenId.toString(), owner, recipient]),
  );
}

// ==================================================== //
// ====                 APPROVAL                   ==== //
// ==================================================== //

/**
 * Approves another address to transfer the given token ID.
 * @param binaryArgs - arguments serialized with `Args` containing the following data in this order:
 * - the owner's - owner address
 * - the spenderAddress - spender address
 * - the tokenID (U64)
 */
export function nft1_approve(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  const callerAddress = Context.caller().toString();

  const tokenId = args
    .nextU64()
    .expect('tokenId argument is missing or invalid');

  const toAddress = new Address(
    args.nextString().expect('toAddress argument is missing or invalid'),
  );

  _approve(tokenId, callerAddress, toAddress.toString());

  generateEvent(
    createEvent('Approve', [
      tokenId.toString(),
      callerAddress,
      toAddress.toString(),
    ]),
  );
}

/**
 * Return if the address is approved to transfer the tokenId
 * @param binaryArgs - arguments serialized with `Args` containing the following data in this order :
 * - the address (string)
 * - the tokenID (U64)
 * @returns true if the address is approved to transfer the tokenId, false otherwise
 */
export function nft1_getApproved(binaryArgs: StaticArray<u8>): StaticArray<u8> {
  const args = new Args(binaryArgs);
  const tokenId = args
    .nextU64()
    .expect('tokenId argument is missing or invalid');

  return stringToBytes(_getApproved(tokenId));
}

export function nft1_setApprovalForAll(binaryArgs: StaticArray<u8>): void {
  const args = new Args(binaryArgs);

  const ownerAddress = Context.caller();
  const operatorAddress = new Address(
    args.nextString().expect('operatorAddress argument is missing or invalid'),
  );
  const approved = args
    .nextBool()
    .expect('approved argument is missing or invalid');

  _setApprovalForAll(
    ownerAddress.toString(),
    operatorAddress.toString(),
    approved,
  );

  generateEvent(
    createEvent('approveForAll', [
      ownerAddress.toString(),
      operatorAddress.toString(),
      approved.toString(),
    ]),
  );
}

export function nft1_isApprovedForAll(
  binaryArgs: StaticArray<u8>,
): StaticArray<u8> {
  const args = new Args(binaryArgs);

  const ownerAddress = args
    .nextString()
    .expect('ownerAddress argument is missing or invalid');
  const operatorAddress = args
    .nextString()
    .expect('operatorAddress argument is missing or invalid');

  return _isApprovedForAll(ownerAddress, operatorAddress)
    ? u32ToBytes(1)
    : u32ToBytes(0);
}
