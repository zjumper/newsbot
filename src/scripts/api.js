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
  var article = {};
  article.title = source.news_Title;
  article.url = source.news_URL;
  article.time = source.news_Time;
  article.abstract = "...";
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
              default_field: "news.news_Title",
              query: question
            }
          }],
          must_not: [],
          should: []
        }
      },
      sort: [
        {"news.news_Time": "desc"},
        "_score"
      ],
      size: config.es.size
    }
  }).then(function(searchResult) {
    var hits = searchResult.hits.hits;
    var articles = [];
    for(var i = 0; i < hits.length; i ++) {
      var article = extractArticle(hits[i]._source);
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
              default_field: "topic.topic_Label", //'topic.label' in feature indeed
              query: question
            }
          }],
          must_not: [],
          should: []
        }
      },
      sort: [
        {"topic.producedTime": "desc"},
        "_score"
      ],
      size: config.es.size
    }
  }).then(function(searchResult) {
    logger.info(searchResult.hits.total);
    var topic = searchResult.hits.hits[0]._source;
    var articles = topic.newsList; //'topic.articles'
    // group articles by date
    var data = _.countBy(articles, function(news) { return news.news_Time.substring(0,8); }); //{date: count}
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
        {"topic.topic_ID": "desc"},
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
      topic.label = hits[i]._source.topic_Label;
      topic.count = hits[i]._source.newsList.length;
      topic.articles = [];
      for(var j = 0; j < hits[i]._source.newsList.length; j ++) {
        var a = {};
        a.title = hits[i]._source.newsList[j].news_Title;
        a.url = hits[i]._source.newsList[j].news_URL;
        a.time = hits[i]._source.newsList[j].news_Time;
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
  // response.status(200).json({
  //   "query":
  //   {
  //     "text": "【Xx】年两会最热的话题是什么？"
  //   },
  //   "status": 200,
  //   "error": "错误信息",
  //   "type":"topic-list",
  //   "data":[
  //     {
  //       "label": "雾霾治理",
  //       "count": 23,
  //       "articles":[
  //         {
  //           "title": "新闻标题",
  //           "url": "原文url",
  //           "time": "文章时间",
  //           "abstract": "内容摘要"
  //         },
  //         {
  //           "title": "新闻标题",
  //           "url": "原文url",
  //           "time": "文章时间",
  //           "abstract": "内容摘要"
  //         }
  //       ]
  //     },
  //     {
  //       "label": "延迟退休",
  //       "count": 18,
  //       "articles":[
  //         {
  //           "title": "新闻标题",
  //           "url": "原文url",
  //           "time": "文章时间",
  //           "abstract": "内容摘要"
  //         },
  //         {
  //           "title": "新闻标题",
  //           "url": "原文url",
  //           "time": "文章时间",
  //           "abstract": "内容摘要"
  //         }
  //       ]
  //     }
  //   ]
  // });
}

/**
 * 问题4
 */
function searchHotPer(query, response) {
  logger.info('searchHotPer');
  response.status(200).json({
    "query":
    {
      "text": "【Xx】年两会最受媒体关注的委员都有谁？"
    },
    "status": 200,
    "error": "错误信息",
    "type":"per-list",
    "data":[
      {
        "name": "习近平",
        "count": 252
      },
      {
        "name": "李克强",
        "count": 192
      }
    ]
  });
}

/**
 * 问题5
 */
function searchHotOrg(query, response) {
  logger.info('searchHotOrg');
  response.status(200).json({
    "query":
    {
      "text": "【Xx】年两会上提到最多的单位或机构都有哪些？"
    },
    "status": 200,
    "error": "错误信息",
    "type":"org-list",
    "data":[
      {
        "name": "环保部",
        "count": 252
      },
      {
        "name": "住建部",
        "count": 192
      }
    ]
  });
}

/**
 * 问题6
 */
function searchHotLoc(query, response) {
  logger.info('searchHotLoc');
  response.status(200).json({
    "query":
    {
      "text": "【xx】年两会上提到最多的【省会城市】是哪些？"
    },
    "status": 200,
    "error": "错误信息",
    "type":"loc-list",
    "data":[
      {
        "name": "北京",
        "count": 252
      },
      {
        "name": "广州",
        "count": 192
      }
    ]
  });
}

/**
 * 问题7
 */
function searchTopicByPer(query, response) {
  logger.info('searchTopicByPer');
  response.status(200).json({
    "query":
    {
      "text": "【Xx】年两会最热的话题是什么？"
    },
    "status": 200,
    "error": "错误信息",
    "type":"topic-list",
    "data":[
      {
        "label": "雾霾治理",
        "count": 23,
        "articles":[
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
      },
      {
        "label": "延迟退休",
        "count": 18,
        "articles":[
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
      }
    ]
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
  response.status(200).json({
    "query":
    {
      "text": "【雾霾治理】相关议题最早是什么时候提出的？"
    },
    "status": 200,      /* 200正常，其他为错误 */
    "error": "错误信息",
    "type":"article-list", /* 说明结果数据的类型，有限枚举值 */
    "data":[
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

/**
 * 问题10

function searchHotTopic(query, response) {
  logger.info('searchHotTopic');
  response.status(200).json({
    "query":
    {
      "text": "【Xx】年两会最热的话题是什么？"
    },
    "status": 200,
    "error": "错误信息",
    "type":"topic-list",
    "data":[
      {
        "label": "雾霾治理",
        "count": 23,
        "articles":[
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
      },
      {
        "label": "延迟退休",
        "count": 18,
        "articles":[
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
      }
    ]
  });
} */

/**
 * 问题11
 * 问题12
 */
function searchPerson(query, response) {
  logger.info('searchPerson');
  response.status(200).json({});
}

/**
 * 问题13
 */
function searchTopicByWord(query, response) {
  logger.info('searchTopicByWord');
  response.status(200).json({
    "query":
    {
      "text": "【Xx】年两会最热的话题是什么？"
    },
    "status": 200,
    "error": "错误信息",
    "type":"topic-list",
    "data":[
      {
        "label": "雾霾治理",
        "count": 23,
        "articles":[
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
      },
      {
        "label": "延迟退休",
        "count": 18,
        "articles":[
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
      }
    ]
  });
}

/**
 * 问题14
 */
function statisticPer(query, response) {
  logger.info('statisticPer');
  response.status(200).json({});
}

/**
 * 问题15
 */
function searchTopicByPer(query, response) {
  logger.info('searchTopicByPer');
  response.status(200).json({
    "query":
    {
      "text": "【Xx】年两会最热的话题是什么？"
    },
    "status": 200,
    "error": "错误信息",
    "type":"topic-list",
    "data":[
      {
        "label": "雾霾治理",
        "count": 23,
        "articles":[
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
      },
      {
        "label": "延迟退休",
        "count": 18,
        "articles":[
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
      }
    ]
  });
}

/**
 * 其他问题
 */
function unsupported(query, response) {
  logger.info('unsupported');
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
