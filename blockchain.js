'use strict';

var CryptoJS = require('crypto-js');
var express = require('express');
var bodyParser = require('body-parser');
var WebSocket = require('ws');

var http_port = process.env.HTTP_PORT || 3001
var p2p_port = process.env.P2P_PORT || 6001
var initialPeers = process.env.PEERS ? process.env.PEERS.split(',') : [];

// decide block structure
class Block {
  constructor(index, previousHash, timestamp, data, hash) {
    this.index = index;
    this.previousHash = previousHash.toString();
    this.timestamp = timestamp;
    this.data = data;
    this.hash = hash.toString();
  }
}

var sockets = [];
var MessageType = {
  QUERY_LATEST: 0,
  QUERY_ALL: 1,
  RESPONSE_BLOCKCHAIN: 2
}

var getGenesisBlock = () => {
  return new Block(0, '0', 1465154705, 'my genesis block', '816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7');
}

var blockchain = [getGenesisBlock()]
console.log(blockchain)

// block needs to be hashed to keep integrity of data
var calculateHash = (index, previousHash, timestamp, data) => {
  return CryptoJS.SHA256(index + previousHash + timestamp + data).toString();
}

// to generate new block, we must know hash of previous block and create rest of required content
var generateNextBlock = blockData => {
  var previousBlock = getLatestBlock();
  var nextIndex = previousBlock.index + 1;
  var nextTimestamp = new Date().getTime() / 1000;
  var nextHash = calculateHash(nextIndex, previousBlock.hash, nextTimestamp, blockData);
  return new Block(nextIndex, previousBlock.hash, nextTimestamp, blockData, nextHash);
}

// validate if block or chain of blocks are valid
var isValidNewBlock = (newBlock, previousBlock) => {
  if (previousBlock.index + 1 !== newBlock.index) {
    console.log('invalid index');
    return false;
  } else if (previousBlock.hash !== newBlock.previousHash) {
    console.log('invalid previousHash');
  } else if (calculateHashForBlock(newBlock) !== newBlock.hash) {
    console.log(`invalid hash: ${calculateHashForBlock(newBlock)} ${newBlock.hash}`)
  }
  return true;
}

// replace chain if blockchain is valid
var replaceChain = newBlocks => {
  if (isValidChain(newBlocks) && newBlocks.length > blockchain.length) {
    console.log('Received blockchain is valid. Replacing current blockchain with received blockchain.');
    blockchain = newBlocks;
    broadcast(responseLatestMsg());
  } else {
    console.log('Received blockchain invalid.');
  }
}