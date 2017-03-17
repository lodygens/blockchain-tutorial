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

* Inside the running container, execute:

```sh
$ cd
$ git clone https://github.com/lodygens/blockchain-tutorial.git
```

