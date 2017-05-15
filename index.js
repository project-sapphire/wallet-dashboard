zmq = require("zmq");
require("colors");
require("draftlog").into(console);

var balances = {
};

var balance_labels = {
};

var rates = {
};

const total_currency = "btc";
var total_label = console.draft("Total: %s %s", total_currency.toUpperCase().yellow, (0).toString().green);
console.log("-------------------".yellow);

function get_rate(currency)
{
	if(currency == total_currency)
	{
		return 1.0;
	}
	else if(currency in rates)
	{
		return rates[currency][total_currency];
	}
	else
	{
		return 0.0
	}
}

function update_total()
{
	let total = 0.0;
	for(currency in balances) {
		total += balances[currency] * get_rate(currency);
	}
	total_label("Total: %s %s", total_currency.toUpperCase().yellow, total.toString().green);
}

function set_rate(currency, rate)
{
	rates[currency] = rate;
	update_total();
}

function set_balance(currency, amount) {
	balances[currency] = amount;
	var label = null;
	if (currency in balance_labels) {
		balance_labels[currency]("- %s %s", currency.toUpperCase().yellow, amount.toString().green);
	} else {
		label = console.draft("- %s %s", currency.toUpperCase().yellow, amount.toString().green);
		balance_labels[currency] = label;
	}
	update_total();
}

function get_currencies(wallet) {
	return new Promise(function(resolve) {
		wallet.send(["*", "currencies"]);
		wallet.once("message", function(...currencies) {
			resolve(currencies.slice(0, -1).map(x => x.toString()));
		});
	});
} 

var rateListener = zmq.socket("sub");
rateListener.connect("tcp://127.0.0.1:1337");
rateListener.subscribe("");

var wallet = zmq.socket("req");
wallet.connect("tcp://127.0.0.1:1340");

rateListener.on("message", function(currency, exchange, timestamp, ...data) {
	currency = currency.toString("utf-8");
	exchange = exchange.toString("utf-8");
	timestamp = timestamp.toString("utf-8");

	let values = {};
	for(var i=0; i<data.length; i+=2)
	{
		let other = data[i].toString();
		if(other == "")
			break;

		let other_price = data[i+1].toString();
		values[other] = other_price;
	}

	set_rate(currency, values);
});

function scheduleUpdate() {
	setTimeout(() => {
		get_currencies(wallet).then(currencies => nextBalance(currencies));
	}, 1000);
}

function nextBalance(currencies) {
	if(currencies.length == 0) return scheduleUpdate();

	wallet.send([currencies[0], "balance"]);
	wallet.once("message", balance => {
		set_balance(currencies[0], Number.parseFloat(balance));
		nextBalance(currencies.slice(1));
	});
}

scheduleUpdate();
