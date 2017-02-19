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

function extractArticle(source) {
  var article = {};
  article.title = source.news_Title;
  article.url = source.news_URL;
  article.time = source.news_Time;
  article.abstract = "...";
  return article;
}

module.exports = (function () {
  var logger = log4js.getLogger('normal');
  return {
    ask: function(req, res) {
      logger.info(req.body);
      var question = req.body.text;
      if(question == undefined)
        question = "question";
      es.search({
        index: 'newsminer_v5.1_index',
        type: 'news',
        // q: 'news_Title:理财'
        body: {
          query: {
            bool: {
              must: [{
                query_string:{
                  default_field: "news.news_Title",
                  query: question
                }
              }],
              must_not: [],
              should: []
            }
          },
          size: config.news.result_size
        }
      }).then(function(searchResult) {
        var hits = searchResult.hits.hits;
        var articles = [];
        for(var i = 0; i < hits.length; i ++) {
          var article = extractArticle(hits[i]._source);
          articles.push(article);
        }
        // logger.info(news.news_Title);
        res.status(200).json({
          "query":{
            "text": question
          },
          "status": 200,
          "type": "article-list",
          "data": articles
        });
      }, function(err) {
        logger.err(err.message);
        res.status(500).json({
          "query":{
            "text": question
          },
          "status": 500,
          "error": err.message
        });
      });
    }
  };
})();
