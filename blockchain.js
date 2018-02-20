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
console.log('Initial blockchain',blockchain)

var initHttpServer = () => {
  var app = express();
  app.use(bodyParser.json());

  // user receives list of all blocks
  app.get('/blocks', (req, res) => {
    res.send(JSON.stringify(blockchain));
  });
  // user creates a new block with content from user
  app.post('/mineBlock', (req, res) => {
    var newBlock = generateNextBlock(req.body.data);
    addBlock(newBlock);
    broadcast(responseLatestMsg());
    console.log(`Block added: ${JSON.stringify(newBlock)}`);
    res.send();
  });
  // user receives list of peers
  app.get('/peers', (req, res) => {
    res.send(sockets.map( s => {
      `${s._socket.remoteAddress}: ${s._socket.remotePort}`
    }))
  })
  // user add peers
  app.post('/addPeer', (req, res) => {
    connectToPeers([req.body.peer]);
    res.send();
  });
  app.listen(http_port, () => {
    console.log(`Listening on port: ${http_port}`)
  });
}

var initP2PServer = () => {
  var server = new WebSocket.Server({port: p2p_port});
  server.on('connection', ws => initConnection(ws));
  console.log(`Listening websocket p2p port on: ${p2p_port}`)
}

var initConnection = ws => {
  sockets.push(ws);
  initMessageHandler(ws);
  initErrorHandler(ws);
  write(ws, queryChainLengthMsg());
}

// initMessageHandler

// initErrorHandler

// to generate new block, we must know hash of previous block and create rest of required content
var generateNextBlock = blockData => {
  var previousBlock = getLatestBlock();
  var nextIndex = previousBlock.index + 1;
  var nextTimestamp = new Date().getTime() / 1000;
  var nextHash = calculateHash(nextIndex, previousBlock.hash, nextTimestamp, blockData);
  return new Block(nextIndex, previousBlock.hash, nextTimestamp, blockData, nextHash);
}

// calculateHashForBlock

// block needs to be hashed to keep integrity of data
var calculateHash = (index, previousHash, timestamp, data) => {
  return CryptoJS.SHA256(index + previousHash + timestamp + data).toString();
}

// addBlock

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

// connectToPeers

// handleBlockchainResponse

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

// isValidChain
// etc.

connectToPeers(initalPeers);
initHttpServer();
initP2PServer();