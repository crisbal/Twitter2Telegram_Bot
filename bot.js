var config = require('./config');
var token = config.telegramToken;

var TelegramBot = require('node-telegram-bot-api');
var Twitter = require('twitter');
var fs = require('fs');
var util = require('./util');

var TWITTER_CONSUMER_KEY = config.TWITTER_CONSUMER_KEY || "";
var TWITTER_CONSUMER_SECRET = config.TWITTER_CONSUMER_SECRET || "";
var TWITTER_ACCESS_TOKEN_KEY = config.TWITTER_ACCESS_TOKEN_KEY || "";
var TWITTER_ACCESS_TOKEN_SECRET = config.TWITTER_ACCESS_TOKEN_SECRET || "";

twitter = new Twitter({
	consumer_key: TWITTER_CONSUMER_KEY,
	consumer_secret: TWITTER_CONSUMER_SECRET,
	access_token_key: TWITTER_ACCESS_TOKEN_KEY,
	access_token_secret: TWITTER_ACCESS_TOKEN_SECRET
});


var bot = new TelegramBot(token, {
    polling: true
});


var db={};
fs.readFile("./database",'utf8', function(err, data) {
    if(err) {
        return console.log(err);
    }
    db = JSON.parse(data);
    console.log("Database Loaded");

    updateMentions();
});


function updateMentions(){
	console.log("Updating Mentions...");
	twitter.get('statuses/mentions_timeline', { count: 10 }, function(error, tweets, response){
	  if(error) console.log(error);

	  for (var i = 0; i < tweets.length; i++) {
	  	tweet = tweets[i];
	  	if (!(db.mentions.indexOf(tweet.id) > -1))
	  	{
	  		db.mentions.push(tweet.id);
	  		bot.sendMessage("-15689316", tweet.user.name + " (" + tweet.user.screen_name + "): " + tweet.text);
	  		console.log("NEW MENTION - " + tweet.user.name + " (" + tweet.user.screen_name + "):" + tweet.text);
	  	}
	  }

	  console.log("Updating Mentions Complete");
	});
}


var uM = setInterval(updateMentions,1000*60);


process.on('SIGINT', function(){
	clearInterval(uM);
	console.log("The bot is shutting down...");
	fs.writeFile("./database",  JSON.stringify(db), { flags: 'w' }, function(err) {
        if(err) {
            return console.log(err);
        }
        console.log("Database Saved");
        process.exit();
    }); 
});

bot.on('message', function(msg) {
    if (msg.text){
        var matchSendTweet = util.parseCommand(msg.text,["tweet","tw"], {joinParams: true});
        if(matchSendTweet){ 
            tweet = matchSendTweet[1]; 

            if(tweet.length > 140)
            {
                bot.sendMessage(msg.chat.id, "Tweet is too long!");
                return;
            }

            console.log("TWEET: " + tweet);

            twitter.post('statuses/update', {status: tweet}, function(error, tweet, response){
                if (error) {
                    bot.sendMessage(msg.chat.id, "Error Tweeting!");
                }
                bot.sendMessage(msg.chat.id, "[Tweet Inviato, stronzi!](https://twitter.com/"+ tweet.user.screen_name +"/status/" + tweet.id_str + ")", {parse_mode: "Markdown"});
            });
        }
    }
});