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

    if(!db.me)
    {   
        console.log("Getting Telegram and Twitter user info");
        db.me = {};

        bot.getMe().then(function(user){
            db.me.telegram = user;
        });
        twitter.get('account/verify_credentials', function(error, user){
            db.me.twitter = user;
        });
    }
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
            db.chats.forEach(function(chat){
                bot.sendMessage(chat, tweet.user.name + " (" + tweet.user.screen_name + "): " + tweet.text);
            });
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
    if (msg.text)
    {
        var matchSendTweet = util.parseCommand(msg.text,["tweet","tw"], {joinParams: true});
        var matchFollow = util.parseCommand(msg.text,["follow","fw"]);
        var matchUnfollow = util.parseCommand(msg.text,["unfollow","uw"]);
        if(matchSendTweet)
        { 
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
        else if(matchFollow)
        {
            who = matchFollow[1]; 
            twitter.post('friendships/create', {screen_name: who}, function(error, user){
                if (error) {
                    bot.sendMessage(msg.chat.id, "Error Following!");
                }
                bot.sendMessage(msg.chat.id, "Now Following [" + user.screen_name + "](https://twitter.com/"+ user.screen_name + ")!", {parse_mode: "Markdown"});
            });
        }
        else if(matchUnfollow)
        {
            who = matchUnfollow[1]; 
            twitter.post('friendships/destroy', {screen_name: who}, function(error, user){
                if (error) {
                    bot.sendMessage(msg.chat.id, "Error Unfollowing!");
                }
                bot.sendMessage(msg.chat.id, "Unfollowed [" + user.screen_name + "](https://twitter.com/"+ user.screen_name + ")!", {parse_mode: "Markdown"});
            });
        }
    }

    if(msg.new_chat_participant)
    {

        if(db.me)
        {
            if(msg.new_chat_participant.id == db.me.telegram.id)
            {
                if(!db.chats)
                    db.chats = [];

                db.chats.push(msg.chat.id);
                console.log("Joined Chat " + msg.chat.id);
                console.log("Using Twitter as [" + db.me.twitter.screen_name + "](https://twitter.com/"+ db.me.twitter.screen_name + ")");
                bot.sendMessage(msg.chat.id, "Using Twitter as [" + db.me.twitter.screen_name + "](https://twitter.com/"+ db.me.twitter.screen_name + ")", {parse_mode: "Markdown"});
            }
        }

    }
    else if(msg.left_chat_participant)
    {
        if(db.me)
        {
            if(msg.left_chat_participant.id == db.me.telegram.id)
            {
                if(db.chats)
                {
                    console.log("Left Chat " + msg.chat.id);
                    db.chats.splice(db.chats.indexOf(msg.chat.id), 1); 
                }
            }
        }
    }

});