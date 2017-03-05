'use strict';

var Segment = require('segment'),
segment = new Segment();

segment.useDefault();
console.log(segment.doSegment("反腐的新闻嗳",{simple: true,stripStopword: true}));
