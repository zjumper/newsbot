'use strict';

var config = require('./config'),
  npc = require('./npc'),
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
  Segment = require('segment'),
  segment = new Segment(),
  log4js = require('log4js');

var logger = log4js.getLogger('normal');
segment.useDefault();
// logger.info(segment.doSegment("习近平在大会上的讲话大大地激励了同志们的热情。"));

function filterStopword(text) {
  var words = segment.doSegment(text, {simple: true,stripStopword: true});
  return words.join(' ');
}

function extractArticle(source) {
  // logger.info(source);
  var article = {};
  // logger.info(source.title);
  article.title = source.title;
  article.url = source.url;
  article.time = source.time.replace(/年|月/g, '-'); //fix some datetime string
  article.abstract = source.content.substring(0, 100);
  return article;
}

function extractPerson(text) {
  var words = segment.doSegment(text);
  for(var i = 0; i < words.length; i ++) {
    var word = words[i];
    if(word.p === 0x0080) {// person name SEGTAG
      return word.w;
    }
  }
  return 'UNKNOWN';
}

function extractProperty(text) {
  var words = segment.doSegment(text);
  // logger.info(words);
  for(var i = 0; i < words.length; i ++) {
    var word = words[i];
    var p = _.propertyOf(config.propMap)(word.w);
    if(p)
      return p;
  }
  return 'UNKNOWN';
}

function extractParsed(query) {
  var ps = query.parsed;
  if(ps === undefined)
    return "";
  var str = "";
  for(var i = 0; i < ps.length; i ++) {
    str += " " + ps[i].label;
  }
  return str;
}

/**
 * 问题1
 */
function searchArticleByWord(query, response) {
  logger.info('searchArticleByWord');
  var question = query.text;
  if(question == undefined)
    question = "question";
  question = filterStopword(question) + extractParsed(query);
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
      if(article.time.match(/^\d+-\d+-\d+/) === null)
        continue;
      // add score field to article data
      article.score = hits[i]._score;
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
    logger.info(json.stringify(ret));
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
  question = filterStopword(question) + extractParsed(query);
  es.search({
    index: config.es.index,
    type: 'news',
    // q: 'news_Title:理财'
    body: {
      query: {
        bool: {
          must: [{
            query_string: {
              default_field: "news.title", //'topic.label' in feature indeed
              query: question
            }
          }],
          must_not: [],
          should: []
        }
      },
      size: 2000
      // sort: [
      //   {"news.time": "desc"},
      //   "_score"
      // ]
    }
  }).then(function(searchResult) {
    // logger.info(searchResult.hits.total);
    var hits = searchResult.hits.hits;
    var articles = [];
    for(var i = 0; i < hits.length; i ++) {
      var article = extractArticle(hits[i]._source);
      if(article.time.match(/^\d+-\d+-\d+/) === null)
        continue;
      articles.push(article);
    }
    // var topic = searchResult.hits.hits[0]._source;
    // var articles = topic.articles; //'topic.articles'
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
    logger.info(json.stringify(ret));
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
        {"topic.updated": "desc"},
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
      topic.score = hits[i]._score;
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
    logger.info(json.stringify(ret));
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
        {"topic.updated": "desc"},
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
    logger.info(json.stringify(ret));
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
        {"topic.updated": "desc"},
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
    logger.info(json.stringify(ret));
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
        {"topic.updated": "desc"},
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
    logger.info(json.stringify(ret));
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
  var person = extractPerson(question);
  es.search({
    index: config.es.index,
    type: 'topic',
    // q: 'news_Title:理财'
    body: {
      query: {
        bool: {
          must: [{
            term: {
              "topic.entities.person": person
            }
          }],
          must_not: [],
          should: []
        }
      },
      sort: [
        {"topic.updated": "desc"},
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
      topic.score = hits[i]._score;
      topic.articles = [];
      var size = topic.count > config.es.size ? config.es.size : topic.count;
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
    logger.info(json.stringify(ret));
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
 * 问题8：人大代表没有界别一说
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
  var person = extractPerson(question);
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
              "news.persons": person
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
      // add score field to article data
      article.score = hits[i]._score;
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
    logger.info(json.stringify(ret));
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
  var question = query.text;
  if(question == undefined)
    question = "question";
  var person = extractPerson(question);
  // logger.info(person);
  var p = _.find(npc.people, function(p) {return p.fullname === person;});
  if(p) {
    var ret = {
      "query":{
        "text": question
      },
      "status": 200,
      "type": "person",
      "data": p
    }
    logger.info(json.stringify(ret));
    response.status(200).json(p);
  } else {
    var ret = {
      "query":{
        "text": question
      },
      "status": 404,
      "error": "NOT FOUND"
    };
    response.status(404).json(ret);
  }
}

/**
 * 问题13
 */
function searchTopicByWord(query, response) {
  logger.info('searchTopicByWord');
  var question = query.text;
  if(question == undefined)
    question = "question";
  question = filterStopword(question) + extractParsed(query);
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
        // {"topic.updated": "desc"},
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
      topic.score = hits[i]._score;
      var size = topic.count > config.es.size ? config.es.size : topic.count;
      topic.articles = [];
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
    logger.info(json.stringify(ret));
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
  var question = query.text;
  if(question == undefined)
    question = "question";
  var p = extractProperty(question);
  if(p === 'UNKNOWN') {
    var ret = {
      "query":{
        "text": question
      },
      "status": 404,
      "error": "NOT FOUND"
    };
    response.status(404).json(ret);
  } else {
    var group = _.groupBy(npc.people, p);
    var count = [];
    for(var p in group) {
      if(p === 'null' || p === null)
        continue;
      var c = {};
      c.name = p;
      c.count = group[p].length;
      // logger.info(c);
      count.push(c);
    }
    var ret = {
      "query":
      {
        "text": question
      },
      "status": 200,
      "type": "per-statistic",
      "data": count
    };
    logger.info(json.stringify(ret));
    response.status(200).json(ret);
  }
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
      logger.info(json.stringify(req.body));
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
