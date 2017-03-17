Blockchain tutorial
====================

This is a tutorial to see a first smart contract in action


# Installation

Installing `blockchain-turorial` is done via `git clone`:

```sh
$ git clone git@gitlab.in2p3.fr:lodygens/blockchain-tutorial.git
$ cd blockchain-tutorial
```

# Docker

Docker is a container platform permitting to ease software distribution.

- [Docker web site ](https://www.docker.com/).

## Install docker on CentOS 6

```sh
$ yum install docker-io
$ service docker start
```

## Check installation
```sh
$ docker ps
```

## Useful Docker commands

### Images

* docker pull [image URL] : to fetch an image
* docker images : to retrieve local images
* docker rmi [image-id] : to delete the local image

### Containers

* docker ps : to retrieve running containers
* docker run [image-id] : to launch a new container with the provided image
* docker exec [container-id] : to execute a command on the running container
* docker kill [container-id] : to kill the running container

### Copy file to/from container

* copy to container : docker cp [source-file] [container-id]:[destination-file]
* copy from container : docker cp [container-id]:[source-file] [destination-file]

# Run ethereum container

## Fetch image
We use the image found from [docker hub](https://hub.docker.com/): zenika/truffle-with-testrpc

```sh
$ docker pull zenika/truffle-with-testrpc
```

## Start container

```sh
$ docker run -ti zenika/truffle-with-testrpc sh
```

* Inside the running container, start testrpc by executing:

```sh
$> cd
$> git clone https://github.com/lodygens/blockchain-tutorial.git
$> cd blockchain-tutorial
$> ./testrpc.sh
EthereumJS TestRPC v3.0.0

Available Accounts
==================
(0) 0xdd37d6074a0a12f432b31406ec67c9f8b49e64aa
(1) 0x4811600e7d149b77929f0afeb6ea389ff7a56203

Private Keys
==================
(0) 0ed9bf56a8d15fb710225749ba83e1e91a90f3b7319277688d9155f96a488a39
(1) 3fb61fb0fa1974f591df36887750ee84474f7bfeb28e39802246b8245660e1f5

Listening on localhost:8545

```

## Test the network

 * Open a new terminal and connect to your container to execute:

```sh
$ docker ps
$ docker exec -it [your-container-id] sh
$> npm install web3
$> node
> var Web3 = require('web3');
undefined
> var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
undefined
> web3.eth.accounts
[ '0xdd37d6074a0a12f432b31406ec67c9f8b49e64aa',
  '0x4811600e7d149b77929f0afeb6ea389ff7a56203' ]
> web3.fromWei(web3.eth.getBalance('0xdd37d6074a0a12f432b31406ec67c9f8b49e64aa'), 'ether')
{ [String: '10000'] s: 1, e: 4, c: [ 10000 ] }
```

## Test the smart contract
 * Open a new terminal and connect to your container to execute:

```sh
$ docker ps
$ docker exec -it [your-container-id] sh
$> cd /root/blockchain-tutorial
$> truffle compile
$> truffle build
$> truffle migrate
Running migration: 1_initial_migration.js
  Deploying Migrations...
Saving successful migration to network...
Saving artifacts...
Running migration: 2_deploy_roulette.js
  Deploying Roulette...
Saving successful migration to network...
Saving artifacts...

$> truffle serve
Serving app on port 8080...
Rebuilding...
Completed without errors on Fri Jan 13 2017 16:34:41 GMT+0100 (CET)

```

 * Open a new terminal and connect to your container to execute:

```sh
$ docker ps
$ docker exec -it [your-container-id] sh
$> cd /root/blockchain-tutorial
$> truffle console
truffle(default)> var contractFromRouletteDeployed = Roulette.deployed();
undefined
truffle(default)> contractFromRouletteDeployed.betSingle(5,{ from: web3.eth.accounts[0], value: 4});
'0x029c47752f033dba08b6003927dbd062f66134caf7e4c06a1cb99780e29e6f1a'
truffle(default)> contractFromRouletteDeployed.getBetsCountAndValue.call();
[ { [String: '1'] s: 1, e: 0, c: [ 1 ] },
  { [String: '4'] s: 1, e: 0, c: [ 4 ] } ]
truffle(default)> contractFromRouletteDeployed.betSingle(5,{ from: web3.eth.accounts[0], value: 4});
'0x13265bc324030a6e4a59f1e5ec90f2f97db33adeac0d9fc03d0b79b0e882ba47'
truffle(default)> contractFromRouletteDeployed.getBetsCountAndValue.call();
[ { [String: '2'] s: 1, e: 0, c: [ 2 ] },
  { [String: '8'] s: 1, e: 0, c: [ 8 ] } ]
truffle(default)> contractFromRouletteDeployed.betSingle(5,{ from: web3.eth.accounts[0], value: 4});
'0x0392bfc89899a4a0b0b41103e29096db452809589018b65727aee0edfa986b9f'
truffle(default)> contractFromRouletteDeployed.getBetsCountAndValue.call();
[ { [String: '3'] s: 1, e: 0, c: [ 3 ] },
  { [String: '12'] s: 1, e: 1, c: [ 12 ] } ]
```

We can see that calling the transaction `betSingle()` modified the contract as expected; this is shown by calling method `getBetsCountAndValue()`


