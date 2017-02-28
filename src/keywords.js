'use strict';

var fs = require('fs'),
  json = require('json3'),
  _ = require('underscore');

var data = fs.readFileSync('news-keywords.json', {encoding:"utf8"});
var all = json.parse(data).hits.hits;
var keywords = [];
for(var i = 0; i < all.length; i ++) {
  var words = all[i].fields.keywords;
  keywords = _.union(keywords, words);
}

var str = keywords.join('\n');
fs.writeFileSync('all.txt', str, {encoding:"utf8"});
