// Import necessary libraries
const express = require('express');
const crypto = require('crypto-js');
const { Web3 } = require('web3');

// Initialize the express app and Web3
const app = express();
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

// Set the server port
const PORT = 3000;

// Enable JSON parsing for incoming requests
app.use(express.json());

// Simulate decentralized peers (other nodes)
const peers = ['http://localhost:3001', 'http://localhost:3002']; // Example peer nodes

// Define the Block class
class Block {
    constructor(index, timestamp, data, previousHash = '') {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash;
        this.hash = this.calculateHash();
        this.nonce = 0;
    }

    // Calculate the hash of the block
    calculateHash() {
        return crypto.SHA256(
            this.index + this.previousHash + this.timestamp + JSON.stringify(this.data) + this.nonce
        ).toString();
    }
}

// Define the Blockchain class
class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.difficulty = 2;
    }

    createGenesisBlock() {
        return new Block(0, '01/01/2020', 'Genesis block', '0');
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    addBlock(newBlock) {
        newBlock.previousHash = this.getLatestBlock().hash;
        this.mineBlock(newBlock);
        this.chain.push(newBlock);
    }

    mineBlock(block) {
        while (block.hash.substring(0, this.difficulty) !== Array(this.difficulty + 1).join('0')) {
            block.nonce++;
            block.hash = block.calculateHash();
        }
        console.log('Block mined: ' + block.hash);
    }

    isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }

            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }
        }
        return true;
    }

    modifyBlock(index, newData) {
        if (index < 1 || index >= this.chain.length) return false; // Genesis block cannot be modified
        this.chain[index].data = newData;
        this.chain[index].hash = this.chain[index].calculateHash();
        return true;
    }
}

// Initialize the blockchain
let blockchain = new Blockchain();

// API to add data to the blockchain
app.post('/addData', (req, res) => {
    const data = req.body;
    const newBlock = new Block(blockchain.getLatestBlock().index + 1, new Date().toISOString(), data);
    blockchain.addBlock(newBlock);
    res.status(200).send({ message: 'Data added successfully', block: newBlock });
});

// API to modify data with peer consensus
app.put('/modifyData/:index', async (req, res) => {
    const { index } = req.params;
    const newData = req.body;

    // Broadcast modification request to peers
    const modificationPromises = peers.map(peer =>
        fetch(`${peer}/validateChange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index, newData }),
        })
    );

    const peerResponses = await Promise.all(modificationPromises);
    const approvals = peerResponses.filter(resp => resp.status === 200).length;

    if (approvals >= peers.length / 2) {
        blockchain.modifyBlock(parseInt(index), newData);
        return res.status(200).send({ message: 'Modification approved by peers.', chain: blockchain.chain });
    } else {
        return res.status(403).send({ message: 'Modification rejected by peers.' });
    }
});

// API to retrieve the entire blockchain
app.get('/getChain', (req, res) => {
    res.status(200).send(blockchain.chain);
});

// API to check blockchain validity
app.get('/validateChain', (req, res) => {
    const isValid = blockchain.isChainValid();
    res.status(200).send({ isValid });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
