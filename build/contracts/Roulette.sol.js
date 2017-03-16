var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("Roulette error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("Roulette error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("Roulette contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of Roulette: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to Roulette.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: Roulette not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "default": {
    "abi": [
      {
        "constant": false,
        "inputs": [],
        "name": "launch",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "bets",
        "outputs": [
          {
            "name": "betType",
            "type": "uint8"
          },
          {
            "name": "player",
            "type": "address"
          },
          {
            "name": "number",
            "type": "uint256"
          },
          {
            "name": "value",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "betType",
            "type": "uint8"
          }
        ],
        "name": "getPayoutForType",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "kill",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "nextRoundTimestamp",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "getBank",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "number",
            "type": "uint256"
          }
        ],
        "name": "betSingle",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "getBankBalance",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "lastRoundTimestamp",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "_bank",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "betEven",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "getBetsCountAndValue",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [],
        "name": "betOdd",
        "outputs": [],
        "payable": true,
        "type": "function"
      },
      {
        "inputs": [
          {
            "name": "interval",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "constructor"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "number",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "nextRoundTimestamp",
            "type": "uint256"
          }
        ],
        "name": "Finished",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "bet",
            "type": "uint8"
          },
          {
            "indexed": false,
            "name": "number",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "value",
            "type": "uint256"
          }
        ],
        "name": "BetDone",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x60606040523461000057604051602080610c1483398101604052515b600381905560028054600160a060020a03191633600160a060020a03161790554281016001555b505b610bc1806100536000396000f300606060405236156100a95763ffffffff60e060020a60003504166301339c2181146100ae57806322af00fa146100bd57806326eafae91461010a57806341c0e1b51461012f5780634bb0948d1461013e57806360d704db1461015d578063703bf91f146101865780637b83b50b1461019357806384beb6e6146101b2578063a336d8c3146101d1578063adde36bb146101fa578063ef37cfe914610204578063f45190351461022a575b610000565b34610000576100bb610234565b005b34610000576100cd6004356104f4565b6040518085600281116100005760ff168152600160a060020a03909416602085015250604080840192909252606083015251908190036080019150f35b346100005761011d60ff60043516610539565b60408051918252519081900360200190f35b34610000576100bb610588565b005b346100005761011d6105b3565b60408051918252519081900360200190f35b346100005761016a6105b9565b60408051600160a060020a039092168252519081900360200190f35b6100bb6004356105c9565b005b346100005761011d61078c565b60408051918252519081900360200190f35b346100005761011d61079d565b60408051918252519081900360200190f35b346100005761016a6107a3565b60408051600160a060020a039092168252519081900360200190f35b6100bb6107b2565b005b346100005761021161097b565b6040805192835260208301919091528051918290030190f35b6100bb6109cb565b005b6000600060006000600060015442101561024d57610000565b6025600019430140069450600093505b60045484101561043b576000925082915081600485815481101561000057906000526020600020906003020160005b505460ff16600281116100005714156102d25784600485815481101561000057906000526020600020906003020160005b506001015414156102cd57600192505b610373565b6002600485815481101561000057906000526020600020906003020160005b505460ff166002811161000057141561032457600085118015610315575060028506155b156102cd57600192505b610373565b6001600485815481101561000057906000526020600020906003020160005b505460ff1660028111610000571415610373576000851180156103695750600285066001145b1561037357600192505b5b5b5b821561042e57600484815481101561000057906000526020600020906003020160005b5060000160019054906101000a9004600160a060020a0316600160a060020a03166108fc6103e7600487815481101561000057906000526020600020906003020160005b505460ff16610539565b600487815481101561000057906000526020600020906003020160005b50600201546040519102801590920291906000818181858888f19350505050151561042e57610000565b5b5b60019093019261025d565b50600180546003548101909155600081815560048054828255829080158290116104aa576003028160030283600052602060002091820191016104aa91905b808211156104a6578054600160a860020a0319168155600060018201819055600282015560030161047a565b5090565b5b505060015460408051898152602081019290925280517f635405568db0e3818a3ddd46a30dfdfb58fdb8d10b69258ea0c1abbbb7fc55f6945091829003019150a15b5050505050565b600481815481101561000057906000526020600020906003020160005b508054600182015460029092015460ff82169350610100909104600160a060020a0316919084565b600080826002811161000057141561055357506023610583565b6002826002811161000057148061057257506001826002811161000057145b1561057f57506002610583565b5060005b919050565b60025433600160a060020a039081169116146105a357610000565b600254600160a060020a0316ff5b565b60015481565b600254600160a060020a03165b90565b3415156105d557610000565b600080805b60045481101561063e57600481815481101561000057906000526020600020906003020160005b5060020154610630600483815481101561000057906000526020600020906003020160005b505460ff16610539565b02820191505b6001016105da565b3461064884610539565b60025491029290920191600160a060020a03163182111561066857610000565b602484111561067657610000565b600480548060010182818154818355818115116106d8576003028160030283600052602060002091820191016106d891905b808211156104a6578054600160a860020a0319168155600060018201819055600282015560030161047a565b5090565b5b505050916000526020600020906003020160005b5060408051608081018252600080825233600160a060020a031660208084018290528385018b90523460609485018190528654600160a860020a031916610100909302929092178655600186018b9055600290950181905583519182529381018990528083019390935290517f4b4f0a1e549c6e59223111e00478036ffbec1a2571852828aa944c7b05c87bc09350918290030190a15b5b5050505b50565b600254600160a060020a0316315b90565b60005481565b600254600160a060020a031681565b3415156107be57610000565b60026000805b60045481101561082857600481815481101561000057906000526020600020906003020160005b506002015461081a600483815481101561000057906000526020600020906003020160005b505460ff16610539565b02820191505b6001016107c4565b3461083284610539565b60025491029290920191600160a060020a03163182111561085257610000565b600480548060010182818154818355818115116108b4576003028160030283600052602060002091820191016108b491905b808211156104a6578054600160a860020a0319168155600060018201819055600282015560030161047a565b5090565b5b505050916000526020600020906003020160005b5060408051608081018252600280825233600160a060020a031660208084018290526000848601819052346060958601819052875460ff1916851774ffffffffffffffffffffffffffffffffffffffff0019166101009094029390931787556001870181905595830182905584519283528201949094528083019390935290517f4b4f0a1e549c6e59223111e00478036ffbec1a2571852828aa944c7b05c87bc09350918290030190a15b5b5050505b565b60008080805b6004548110156109ba57600481815481101561000057906000526020600020906003020160005b5060020154820191505b600101610981565b600454935090915081905b50509091565b3415156109d757610000565b60016000805b600454811015610a4157600481815481101561000057906000526020600020906003020160005b5060020154610a33600483815481101561000057906000526020600020906003020160005b505460ff16610539565b02820191505b6001016109dd565b34610a4b84610539565b60025491029290920191600160a060020a031631821115610a6b57610000565b60048054806001018281815481835581811511610acd57600302816003028360005260206000209182019101610acd91905b808211156104a6578054600160a860020a0319168155600060018201819055600282015560030161047a565b5090565b5b505050916000526020600020906003020160005b5060408051608081018252600180825233600160a060020a031660208084018290526000848601819052346060958601819052875460ff1916851774ffffffffffffffffffffffffffffffffffffffff001916610100909402939093178755868401819055600290960182905584519283528201949094528083019390935290517f4b4f0a1e549c6e59223111e00478036ffbec1a2571852828aa944c7b05c87bc09350918290030190a15b5b5050505b5600a165627a7a72305820c12968eeb5fee988670cb1798ef39334caeceea288cf2ba7151a0aaa092723190029",
    "events": {
      "0x635405568db0e3818a3ddd46a30dfdfb58fdb8d10b69258ea0c1abbbb7fc55f6": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "number",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "nextRoundTimestamp",
            "type": "uint256"
          }
        ],
        "name": "Finished",
        "type": "event"
      },
      "0x4b4f0a1e549c6e59223111e00478036ffbec1a2571852828aa944c7b05c87bc0": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "bet",
            "type": "uint8"
          },
          {
            "indexed": false,
            "name": "number",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "value",
            "type": "uint256"
          }
        ],
        "name": "BetDone",
        "type": "event"
      }
    },
    "updated_at": 1489587991627,
    "links": {},
    "address": "0x0b18f1395592a36f7c3f6b4936b8bc0fa2bd324d"
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "Roulette";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.Roulette = Contract;
  }
})();
