pragma solidity ^0.4.2;

/**
 * This contract describes a roulette wheel
 * See https://www.ethereum-france.com/ecrire-une-dapp-pour-ethereum-1-smart-contract/
 * @author Oleg Lodygensky (oleg.lodygensky@lal.in2p3.fr)
 */
contract Roulette {

    uint public lastRoundTimestamp;
    uint public nextRoundTimestamp;
    /*
     * This is the creator
     */
    address public _bank;
    uint _interval;

    enum BetType { Single, Odd, Even }

    struct Bet {
        BetType betType;
        address player;
        uint number;
        uint value;
    }

    Bet[] public bets;

	/**
	 * This constructor saves the creator as the bank
	 */
   function Roulette(uint interval)  {
        _interval = interval;
        _bank = msg.sender;
        nextRoundTimestamp = now + _interval;
    }

	/**
	 * This event is sent at each turn
	 */
    event Finished(uint number, uint nextRoundTimestamp);
	/**
	 * This event is sent at each bet
	 */
    event BetDone(BetType bet, uint number, uint value);

    modifier onlyOwner {
        if (msg.sender != _bank) throw;
        _;
    }

    modifier transactionMustContainEther() {
        if (msg.value == 0) throw;
        _;
    }
    
    modifier bankMustBeAbleToPayForBetType(BetType betType) {
        uint necessaryBalance = 0;
        for (uint i = 0; i < bets.length; i++) {
            necessaryBalance += getPayoutForType(bets[i].betType) * bets[i].value;
        }
        necessaryBalance += getPayoutForType(betType) * msg.value;
        if (necessaryBalance > _bank.balance) throw;
        _;
    }
    function getBetsCountAndValue() constant returns(uint, uint) {
        uint value = 0;
        for (uint i = 0; i < bets.length; i++) {
            value += bets[i].value;
        }
        return (bets.length, value);
    }

    function getBankBalance() constant returns (uint) {
		return _bank.balance;
    }
 
    function getBank() constant returns (address) {
		return _bank;
    }
 
    function getPayoutForType(BetType betType) constant returns(uint) {
        if (betType == BetType.Single) return 35;
        if (betType == BetType.Even || betType == BetType.Odd) return 2;
        return 0;
    }

    function betSingle(uint number) payable transactionMustContainEther bankMustBeAbleToPayForBetType(BetType.Single) {
        if (number > 36) throw;
        bets.push(Bet({
            betType: BetType.Single,
            player: msg.sender,
            number: number,
            value: msg.value
        }));
        BetDone(BetType.Single, number, msg.value);
    }

    function betEven() payable transactionMustContainEther() bankMustBeAbleToPayForBetType(BetType.Even) {
        bets.push(Bet({
            betType: BetType.Even,
            player: msg.sender,
            number: 0,
            value: msg.value
        }));
        BetDone(BetType.Even, 0, msg.value);
    }

    function betOdd() payable transactionMustContainEther() bankMustBeAbleToPayForBetType(BetType.Odd) {
        bets.push(Bet({
            betType: BetType.Odd,
            player: msg.sender,
            number: 0,
            value: msg.value
        }));
        BetDone(BetType.Odd, 0, msg.value);
    }

    function launch() {
        if (now < nextRoundTimestamp) throw;

        uint number = uint(block.blockhash(block.number - 1)) % 37;
        
        for (uint i = 0; i < bets.length; i++) {
            bool won = false;
            uint payout = 0;
            if (bets[i].betType == BetType.Single) {
                if (bets[i].number == number) {
                    won = true;
                }
            } else if (bets[i].betType == BetType.Even) {
                if (number > 0 && number % 2 == 0) {
                    won = true;
                }
            } else if (bets[i].betType == BetType.Odd) {
                if (number > 0 && number % 2 == 1) {
                    won = true;
                }
            }
            if (won) {
                if(!bets[i].player.send(bets[i].value * getPayoutForType(bets[i].betType))) {
			throw;
		}
            }
        }

        uint thisRoundTimestamp = nextRoundTimestamp;
        nextRoundTimestamp = thisRoundTimestamp + _interval;
        lastRoundTimestamp = thisRoundTimestamp;

        bets.length = 0;

        Finished(number, nextRoundTimestamp);
    }

    function kill() {
        if (msg.sender != _bank) throw;
        suicide(_bank);
    }
    
}
