var express = require('express'),
  session = require('express-session'),
  path = require('path'),
  bodyParser = require('body-parser'),
  log4js = require('log4js'),
  api = require('./scripts/api'),
  config = require('./scripts/config');

log4js.configure({
  appenders: [
    { type: 'console', //控制台输出
      category: 'normal'
    },
    {
      type: 'file', //文件输出
      filename: 'logs/log.log',
      maxLogSize: 1024,
      backups:3,
      category: 'normal'
    }
  ]
});

var app = express();

// app.use(express.static('app'));
app.use(session({secret: '20170218'}));
app.use(bodyParser.json());
var logger = log4js.getLogger('normal');
logger.setLevel('DEBUG');
app.use(log4js.connectLogger(logger, {level:log4js.levels.DEBUG}));

logger.info('Server initializing ...');

app.post('/api/ask', api.ask);
app.listen(3000);
