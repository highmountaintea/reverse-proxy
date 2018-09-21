require('dotenv').config();
const https = require('https');
const httpProxy = require('http-proxy');
const url = require("url");
const fs = require('fs');
const bunyan = require('bunyan');
const Bunyan2Loggly = require('bunyan-loggly');
const addressMap = require('./assets/address-map.json');

let logglyConfig = {
	token: process.env.LOGGLY_TOKEN,
	subdomain: process.env.LOGGLY_SUBDOMAIN,
};
// console.log(logglyConfig);
   
let logglyStream = new Bunyan2Loggly(logglyConfig, 5, 500);
   
// create the logger
let logger = bunyan.createLogger({
	name: process.env.LOGGERNAME,
	streams: [
	  {
      type: 'raw',
      level: 'trace',
      stream: logglyStream,
	  },
	  {
      level: 'debug',
      stream: process.stdout,
	  },
	],
});
  
logger.info('logger started');


var options = {
  key: fs.readFileSync('assets/ssl.key'),
  cert: fs.readFileSync('assets/ssl.crt'),
  ca: [ fs.readFileSync('assets/ssl.ca-bundle') ],
};


//
// Create a proxy server with custom application logic
//
var proxy = httpProxy.createProxyServer({});

//
// Create your custom server and just call `proxy.web()` to proxy
// a web request to the target passed in the options
// also you can use `proxy.ws()` to proxy a websockets request
//
var server = https.createServer(options, function(req, res) {
	logger.info({ host: req.headers.host, url: req.url, headers: req.headers,
		ip: req.connection.remoteAddress },
		'request: %s %s', req.headers.host, req.url);
	var _setHeader = res.setHeader.bind(res);
	
	res.setHeader = function(key, val) {
		// console.log(key, val);
		if (key && key.toLowerCase() == 'location') {
			// console.log(key, val);
			if (val) val = val.replace(/^http\:/, 'https:');
		}
		_setHeader(key, val);
	};
	
  req.headers['X-Forwarded-Proto'] = 'https';
  let address = addressMap[req.headers.host];
  if (address == null) {
    logger.info({ url: req.url }, 'Invalid host: %s', req.headers.host);
    res.writeHead(500);
    res.end('Not found');
  } else {
    proxy.web(req, res, { target: address }, function(e) {
      res.end('' + e);
    });
  }
});

console.log("listening on port 443")
server.listen(443);
