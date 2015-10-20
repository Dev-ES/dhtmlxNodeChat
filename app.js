/*
 * sudo npm init
 * npm install express --save
 * npm install express --save
 * npm install -g strongloop
 * npm install --save ws
 * npm install express-ws
 * npm install redis
 */
var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
var app_name = 'dhtmlxNodeChat';
var redis = require('redis');
var subscriber = redis.createClient();
var publisher = redis.createClient();
var redis_client = redis.createClient();
var port = 4080;
var users = [];
var total_users_online = 0;

var def_channel = '#random';
var users_online_list_name = 'dhtmlxNodeChat_users_online';

try
{
	redis_client.del(users_online_list_name, function(err, reply) {
		
		if( err ) throw err;

		console.log(reply);
		console.log('The online list users was restarted')
	});
}
catch(e)
{

}


app.use(express.static(__dirname + '/public'));

//app.use( function(req, res, next) {
//console.log('middleware');
//req.testing = 'testing';
//	return next();
//} );

app.get('/', function(req, res, next) {
	res.send('Hello World!');
	//console.log('get route', req.testing);
	res.end();
});

subscriber.on("message", function(channel, message) {
	//message.channel = channel;
	var aWss = expressWs.getWss('/');
	aWss.clients.forEach(function(client) {
		client.send(message);
	});
});



app.ws('/', function(ws, req) {

	var client_id = Math.random(),
		person_entity = null;

	subscriber.subscribe(def_channel);

	ws.on('message', function(envelope) {
		envelope = JSON.parse(envelope);
		var msg = JSON.parse(envelope.msg);
		msg.type = msg.type || 'message'; // disconnect, message, new_user
		msg.channel = msg.channel || def_channel; // disconnect, message, new_user

		msg.time = 10000000;
		msg.address = '';
		msg.client_id = client_id;

		if (msg.type == "new_username") 
		{
			if (msg.person) {
				msg.person.client_id = client_id;
				person_entity = msg.person;

				var mstring = JSON.stringify(person_entity);

				redis_client.rpush([users_online_list_name, mstring], function(err, reply) {
					// reply returns total users online
					//console.log(reply);
					total_users_online = reply;
					redis_client.lrange(users_online_list_name, 0, -1, function(err, reply) {
						var users = [];
						for (var index = 0; index < reply.length; index++) {
							var user = JSON.parse(reply[index]);
							users.push(user);
						}
						msg.users = users;
						console.log('client id ' + client_id + ' is identified as ' + person_entity.nick );
						publisher.publish(msg.channel, JSON.stringify(msg));
					});

				});
			}
		} 
		else if (msg.type == "disconnect") 
		{
			redis_client.lrange(users_online_list_name, 0, -1, function(err, reply) {
				var users = [];
				for (var index = 0; index < reply.length; index++) {
						var user = JSON.parse(reply[index]);
						users.push(user);
				}
				users.forEach(function(userObj, index, array) {
					if (userObj.client_id == client_id) {
						//users.splice(index, 1);

						var mstring = JSON.stringify(userObj);
						var msg = {};
						msg.type = 'disconnect'; // disconnect, message, new_user
						msg.client_id = client_id;
						//console.log('lrem ', mstring);

						redis_client.lrem(users_online_list_name, 0, mstring, function(err, reply) {
							if( reply == 1)
							{
								redis_client.lrange(users_online_list_name, 0, -1, function(err, reply) {
									console.log('remaining online users');
									console.log(reply);
								});
								publisher.publish(msg.channel, JSON.stringify(msg));
							}
						});	
					}
				});
			});
		} else {
			publisher.publish(msg.channel, JSON.stringify(msg));
		}



		//var aWss = expressWs.getWss('/');
		//aWss.clients.forEach(function (client) {
		//	client.send( JSON.stringify( msg ) );
		//});

		//console.log( 'sending ', JSON.stringify( msg ) );
		//ws.send( JSON.stringify( msg ) );
	});

	ws.on('close', function() {
		/*users.forEach(function( userObj, index, array ){
			if( userObj.client_id == client_id )
			{
				users.splice(index, 1);
				var msg = JSON.parse(envelop.msg);
				msg.type = 'disconnect'; // disconnect, message, new_user
				msg.time = 10000000;
			    msg.address = '';
				msg.client_id = client_id;
				ws.send(msg);
			}
		});*/
		console.log('client id ' + client_id + ' is disconnected ');
		
	});
	console.log('client id ' + client_id + ' is connected ');
});


var server = app.listen(port, function() {
	var host = server.address().address;
	var port = server.address().port;

	console.log(app_name + ' is listening at http://%s:%s', host, port);
});

module.exports = app;