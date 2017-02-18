'use strict';

var config = require('./config'),
  json = require('json3'),
  // redis = require('redis'),
  _ = require('underscore'),
  dateformat = require('dateformat'),
  // client = redis.createClient(),
  log4js = require('log4js');

module.exports = (function () {
  var logger = log4js.getLogger('normal');
  return {
    ask: function(req, res) {
      logger.info(req.body);

      res.status(200).json({
        "query":{
          "text": req.body.text
        },
        "status": 200,
        "type": "article-list",
        "data": [
          {
            "title": "新闻标题",
            "url": "原文url",
            "time": "文章时间",
            "abstract": "内容摘要"
          },
          {
            "title": "新闻标题",
            "url": "原文url",
            "time": "文章时间",
            "abstract": "内容摘要"
          },
          {
            "title": "新闻标题",
            "url": "原文url",
            "time": "文章时间",
            "abstract": "内容摘要"
          }
        ]
      });
    }
  };
})();
