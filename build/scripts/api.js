'use strict';

var config = require('./config'),
  json = require('json3'),
  // redis = require('redis'),
  _ = require('underscore'),
  dateformat = require('dateformat'),
  // client = redis.createClient(),
  elasticsearch = require('elasticsearch'),
  es = new elasticsearch.Client({
    host: config.es.host,
    log: 'info'
  }),
  log4js = require('log4js');

module.exports = (function () {
  var logger = log4js.getLogger('normal');
  return {
    ask: function(req, res) {

      es.search({
        index: 'newsminer_v5.1_index',
        type: 'news',
        // q: 'news_Title:理财'
        body: {
          query: {
            match: {
              news_Title: '理财'
            }
          }
        }
      }).then(function(res) {
        var news = res.hits.hits[0]._source;
        logger.info(news.news_Title);
      }, function(err) {
        logger.err(err.message);
      });

      logger.info(req.body);
      var question = req.body.text;
      if(question == undefined)
        question = "question";

      res.status(200).json({
        "query":{
          "text": question
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
