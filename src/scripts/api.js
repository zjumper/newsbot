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

var logger = log4js.getLogger('normal');

function extractArticle(source) {
  // logger.info(source);
  var article = {};
  // logger.info(source.title);
  article.title = source.title;
  article.url = source.url;
  article.time = source.time;
  article.abstract = source.content.substring(0, 100);
  return article;
}

/**
 * 问题1
 */
function searchArticleByWord(query, response) {
  logger.info('searchArticleByWord');
  var question = query.text;
  if(question == undefined)
    question = "question";
  es.search({
    index: config.es.index,
    type: 'news',
    // q: 'news_Title:理财'
    body: {
      query: {
        bool: {
          must: [{
            query_string:{
              default_field: "news.title",
              query: question
              // "news.title": question
            }
          }],
          must_not: [],
          should: []
        }
      },
      sort: [
        {"news.time": "desc"},
        "_score"
      ],
      size: config.es.size
    }
  }).then(function(searchResult) {
    var hits = searchResult.hits.hits;
    var articles = [];
    for(var i = 0; i < hits.length; i ++) {
      var article = extractArticle(hits[i]._source);
      // logger.info(article);
      articles.push(article);
    }
    // logger.info(news.news_Title);
    var ret = {
      "query":{
        "text": question
      },
      "status": 200,
      "type": "article-list",
      "data": articles
    };
    // logger.info(ret);
    response.status(200).json(ret);
  }, function(err) {
    logger.err(err.message);
    var ret = {
      "query":{
        "text": question
      },
      "status": 500,
      "error": err.message
    };
    response.status(500).json(ret);
  });
}

/**
 * 问题2
 */
function statisticTopicTrend(query, response) {
  logger.info('statisticTopicTrend');
  var question = query.text;
  if(question == undefined)
    question = "question";
  es.search({
    index: config.es.index,
    type: 'topic',
    // q: 'news_Title:理财'
    body: {
      query: {
        bool: {
          must: [{
            query_string: {
              default_field: "topic.label", //'topic.label' in feature indeed
              query: question
            }
          }],
          must_not: [],
          should: []
        }
      },
      sort: [
        {"topic.updated": "desc"},
        "_score"
      ],
      size: config.es.size
    }
  }).then(function(searchResult) {
    logger.info(searchResult.hits.total);
    var topic = searchResult.hits.hits[0]._source;
    var articles = topic.articles; //'topic.articles'
    // group articles by date
    var data = _.countBy(articles, function(news) { return news.time.substring(0,10); }); //{date: count}
    var resort = [];
    var keys = _.keys(data);
    var values = _.values(data);
    for(var i = 0; i < keys.length; i ++) {
      resort.push({date: keys[i], count: values[i]});
    }
    resort = _.sortBy(resort, 'date');
    // logger.info(news.news_Title);
    var ret = {
      "query":{
        "text": question
      },
      "status": 200,
      "type": "date-num-seq",
      "data": resort
    };
    logger.info(ret);
    response.status(200).json(ret);
  }, function(err) {
    logger.err(err.message);
    var ret = {
      "query":{
        "text": question
      },
      "status": 500,
      "error": err.message
    };
    response.status(500).json(ret);
  });
}

/**
 * 问题3,10
 */
function searchHotTopic(query, response) {
  logger.info('searchHotTopic');
  var question = query.text;
  if(question == undefined)
    question = "question";
  es.search({
    index: config.es.index,
    type: 'topic',
    // q: 'news_Title:理财'
    body: {
      query: {
        match_all: {}
      },
      sort: [
        {"topic.count": "desc"},
        "_score"
      ],
      size: config.es.size
    }
  }).then(function(searchResult) {
    // logger.info(searchResult.hits.total);
    var hits = searchResult.hits.hits;
    var topics = [];
    for(var i = 0; i < hits.length; i ++) {
      var topic = {};
      topic.label = hits[i]._source.label;
      topic.count = hits[i]._source.articles.length;
      topic.articles = [];
      var len = hits[i]._source.articles.length;
      var size = len > config.es.size ? config.es.size : len;
      for(var j = 0; j < size; j ++) {
        var a = {};
        a.title = hits[i]._source.articles[j].title;
        a.url = hits[i]._source.articles[j].url;
        a.time = hits[i]._source.articles[j].time;
        a.abstract = "...";
        topic.articles.push(a);
      }
      topics.push(topic);
    }
    var ret = {
      "query":{
        "text": question
      },
      "status": 200,
      "type": "topic-list",
      "data": topics
    };
    logger.info(ret);
    response.status(200).json(ret);
  }, function(err) {
    logger.err(err.message);
    var ret = {
      "query":{
        "text": question
      },
      "status": 500,
      "error": err.message
    };
    response.status(500).json(ret);
  });
}

/**
 * 问题4
 */
function searchHotPer(query, response) {
  logger.info('searchHotPer');
  var question = query.text;
  if(question == undefined)
    question = "question";
  es.search({
    index: config.es.index,
    type: 'topic',
    // q: 'news_Title:理财'
    body: {
      query: {
        match_all: {}
      },
      sort: [
        {"topic.count": "desc"},
        "_score"
      ],
      size: config.es.size
    }
  }).then(function(searchResult) {
    var hits = searchResult.hits.hits;
    var p = [];
    var count = [];
    for(var i = 0; i < hits.length; i ++) {
      var topic = hits[i]._source;
      for(var j = 0; j < topic.entities.person.length; j ++) {
        var index = _.indexOf(p, topic.entities.person[j]);
        if(index > -1) {
          // logger.info(topic.entities.person[j]);
          count[index] = count[index] + topic.count;
        } else {
          p.push(topic.entities.person[j]);
          count.push(topic.count);
        }
      }
    }
    var percount = [];
    for(var i = 0; i < p.length; i++) {
      percount.push({name: p[i], count: count[i]})
    }
    percount = _.sortBy(percount, "count").reverse().slice(0, 3);
    var ret = {
      "query":{
        "text": question
      },
      "status": 200,
      "type": "per-list",
      "data": percount
    };
    response.status(200).json(ret);
  }, function(err) {
    logger.err(err.message);
    var ret = {
      "query":{
        "text": question
      },
      "status": 500,
      "error": err.message
    };
    response.status(500).json(ret);
  });
}

/**
 * 问题5
 */
function searchHotOrg(query, response) {
  logger.info('searchHotOrg');
  var question = query.text;
  if(question == undefined)
    question = "question";
  es.search({
    index: config.es.index,
    type: 'topic',
    // q: 'news_Title:理财'
    body: {
      query: {
        match_all: {}
      },
      sort: [
        {"topic.count": "desc"},
        "_score"
      ],
      size: config.es.size
    }
  }).then(function(searchResult) {
    var hits = searchResult.hits.hits;
    var p = [];
    var count = [];
    for(var i = 0; i < hits.length; i ++) {
      var topic = hits[i]._source;
      for(var j = 0; j < topic.entities.organization.length; j ++) {
        var index = _.indexOf(p, topic.entities.organization[j]);
        if(index > -1) {
          count[index] += topic.count;
        } else {
          p.push(topic.entities.organization[j]);
          count.push(topic.count);
        }
      }
    }
    var percount = [];
    for(var i = 0; i < p.length; i++) {
      percount.push({name: p[i], count: count[i]})
    }
    percount = _.sortBy(percount, "count").reverse().slice(0, 3);
    var ret = {
      "query":{
        "text": question
      },
      "status": 200,
      "type": "org-list",
      "data": percount
    };
    response.status(200).json(ret);
  }, function(err) {
    logger.err(err.message);
    var ret = {
      "query":{
        "text": question
      },
      "status": 500,
      "error": err.message
    };
    response.status(500).json(ret);
  });
}

/**
 * 问题6
 */
function searchHotLoc(query, response) {
  logger.info('searchHotLoc');
  var question = query.text;
  if(question == undefined)
    question = "question";
  es.search({
    index: config.es.index,
    type: 'topic',
    // q: 'news_Title:理财'
    body: {
      query: {
        match_all: {}
      },
      sort: [
        {"topic.count": "desc"},
        "_score"
      ],
      size: config.es.size
    }
  }).then(function(searchResult) {
    var hits = searchResult.hits.hits;
    var p = [];
    var count = [];
    for(var i = 0; i < hits.length; i ++) {
      var topic = hits[i]._source;
      for(var j = 0; j < topic.entities.location.length; j ++) {
        var index = _.indexOf(p, topic.entities.location[j]);
        if(index > -1) {
          count[index] += topic.count;
        } else {
          p.push(topic.entities.location[j]);
          count.push(topic.count);
        }
      }
    }
    var percount = [];
    for(var i = 0; i < p.length; i++) {
      percount.push({name: p[i], count: count[i]})
    }
    percount = _.sortBy(percount, "count").reverse().slice(0, 3);
    var ret = {
      "query":{
        "text": question
      },
      "status": 200,
      "type": "loc-list",
      "data": percount
    };
    response.status(200).json(ret);
  }, function(err) {
    logger.err(err.message);
    var ret = {
      "query":{
        "text": question
      },
      "status": 500,
      "error": err.message
    };
    response.status(500).json(ret);
  });
}

/**
 * 问题7
 */
function searchTopicByPer(query, response) {
  logger.info('searchTopicByPer');
  var question = query.text;
  if(question == undefined)
    question = "question";
  es.search({
    index: config.es.index,
    type: 'topic',
    // q: 'news_Title:理财'
    body: {
      query: {
        bool: {
          must: [{
            term: {
              "topic.entities.person": question
            }
          }],
          must_not: [],
          should: []
        }
      },
      sort: [
        {"topic.count": "desc"},
        {"topic.updated": "desc"},
        "_score"
      ],
      size: config.es.size
    }
  }).then(function(searchResult) {
    logger.info(searchResult.hits.total);
    var hits = searchResult.hits.hits;
    var topics = [];
    for(var i = 0; i < hits.length; i ++) {
      var topic = {};
      topic.label = hits[i]._source.label;
      topic.count = hits[i]._source.articles.length;
      topic.articles = [];
      for(var j = 0; j < hits[i]._source.articles.length; j ++) {
        var a = {};
        a.title = hits[i]._source.articles[j].title;
        a.url = hits[i]._source.articles[j].url;
        a.time = hits[i]._source.articles[j].time;
        a.abstract = "...";
        topic.articles.push(a);
      }
      topics.push(topic);
    }
    var ret = {
      "query":{
        "text": question
      },
      "status": 200,
      "type": "topic-list",
      "data": topics
    };
    logger.info(ret);
    response.status(200).json(ret);
  }, function(err) {
    logger.err(err.message);
    var ret = {
      "query":{
        "text": question
      },
      "status": 500,
      "error": err.message
    };
    response.status(500).json(ret);
  });
}

/**
 * 问题8
 */
function searchPerByParty(query, response) {
  logger.info('searchPerByParty');
  response.status(200).json({
    "query":
    {
      "text": "【xx】年两会有哪些【文艺娱乐】界委员？"
    },
    "status": 200,
    "error": "错误信息",
    "type":"per-list",
    "data":[
      {
        "name": "韩红",
        "count": 252
      },
      {
        "name": "姜昆",
        "count": 192
      }
    ]
  });
}

/**
 * 问题9
 */
function searchArticleByPer(query, response) {
  logger.info('searchArticleByPer');
  var question = query.text;
  if(question == undefined)
    question = "question";
  es.search({
    index: config.es.index,
    type: 'news',
    // q: 'news_Title:理财'
    body: {
      query: {
        bool: {
          must: [{
            term:{
              //default_field: "news.title",
              //query: question
              "news.persons": question
            }
          }],
          must_not: [],
          should: []
        }
      },
      sort: [
        {"news.time": "desc"},
        "_score"
      ],
      size: config.es.size
    }
  }).then(function(searchResult) {
    var hits = searchResult.hits.hits;
    var articles = [];
    for(var i = 0; i < hits.length; i ++) {
      var article = extractArticle(hits[i]._source);
      // logger.info(article);
      articles.push(article);
    }
    // logger.info(news.news_Title);
    var ret = {
      "query":{
        "text": question
      },
      "status": 200,
      "type": "article-list",
      "data": articles
    };
    // logger.info(ret);
    response.status(200).json(ret);
  }, function(err) {
    logger.err(err.message);
    var ret = {
      "query":{
        "text": question
      },
      "status": 500,
      "error": err.message
    };
    response.status(500).json(ret);
  });
}

/**
 * 问题11
 * 问题12
 */
function searchPerson(query, response) {
  logger.info('searchPerson');
  response.status(200).json({
    "fullname": "姓名",
    "age": 45,
    "gender": "性别",
    "nation": "民族",
    "birthdate": "出生日期",
    "birthplace": "出生地",
    "occupation": "职业",
    "title": "职务",
    "party": "党派",
    "delegation": "代表团",
    "education": "学历",
    "degree": "学位",
    "college": "毕业院校",
    "major": "专业",
    "award": "获得荣誉",
    "achivement": "成就",
    "spouse": "配偶",
    "photo": "照片",
    "domain": "界别",
    "cppcc": 0,
    "npc": 1
  });
}

/**
 * 问题13
 */
function searchTopicByWord(query, response) {
  logger.info('searchTopicByWord');
  var question = query.text;
  if(question == undefined)
    question = "question";
  es.search({
    index: config.es.index,
    type: 'topic',
    // q: 'news_Title:理财'
    body: {
      query: {
        bool: {
          must: [{
            query_string:{
              default_field: "topic.label",
              query: question
              // "topic.label": question
            }
          }],
          must_not:[],
          should:[]
        }
      },
      sort: [
        "_score",
        {"topic.count": "desc"}
      ],
      size: config.es.size
    }
  }).then(function(searchResult) {
    logger.info(searchResult.hits.total);
    var hits = searchResult.hits.hits;
    var topics = [];
    for(var i = 0; i < hits.length; i ++) {
      var topic = {};
      topic.label = hits[i]._source.label;
      topic.count = hits[i]._source.articles.length;
      topic.articles = [];
      for(var j = 0; j < hits[i]._source.articles.length; j ++) {
        var a = {};
        a.title = hits[i]._source.articles[j].title;
        a.url = hits[i]._source.articles[j].url;
        a.time = hits[i]._source.articles[j].time;
        a.abstract = "...";
        topic.articles.push(a);
      }
      topics.push(topic);
    }
    var ret = {
      "query":{
        "text": question
      },
      "status": 200,
      "type": "topic-list",
      "data": topics
    };
    logger.info(ret);
    response.status(200).json(ret);
  }, function(err) {
    logger.err(err.message);
    var ret = {
      "query":{
        "text": question
      },
      "status": 500,
      "error": err.message
    };
    response.status(500).json(ret);
  });
}

/**
 * 问题14
 */
function statisticPer(query, response) {
  logger.info('statisticPer');
  response.status(200).json({
    "axis": "age",
    "data": [
      {
        "x": "30-40",
        "y": 23
      },
      {
        "x": "40-50",
        "y": 334
      },
      {
        "x": "50-60",
        "y": 634
      },
      {
        "x": "60-70",
        "y": 34
      },
      {
        "x": "70-",
        "y": 10
      }
    ]
  });
}

/**
 * 其他问题
 */
function unsupported(query, response) {
  logger.info('unsupported');
  var question = query.text;
  if(question == undefined)
    question = "question";
  var ret = {
    "query":{
      "text": question
    },
    "status": 404,
    "error": 'Sorry, unsupported query.'
  };
  response.status(404).json(ret);
}

module.exports = (function () {
  return {
    ask: function(req, res) {
      logger.info(req.body);
      // var answer = {};
      switch(req.body.catalog) {
        case 1:
          searchArticleByWord(req.body, res);
          break;
        case 2:
          statisticTopicTrend(req.body, res);
          break;
        case 3:
          searchHotTopic(req.body, res);
          break;
        case 4:
          searchHotPer(req.body, res);
          break;
        case 5:
          searchHotOrg(req.body, res);
          break;
        case 6:
          searchHotLoc(req.body, res);
          break;
        case 7:
          searchTopicByPer(req.body, res);
          break;
        case 8:
          searchPerByParty(req.body, res);
          break;
        case 9:
          searchArticleByPer(req.body, res);
          break;
        case 10:
          searchHotTopic(req.body, res);
          break;
        case 11:
        case 12:
          searchPerson(req.body, res);
          break;
        case 13:
          searchTopicByWord(req.body, res);
          break;
        case 14:
          statisticPer(req.body, res);
          break;
        case 15:
          searchTopicByPer(req.body, res);
          break;
        default:
          unsupported(req.body, res);
      }
    }
  };
})();
