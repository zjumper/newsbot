'use strict';

var fs = require('fs'),
  json = require('json3');

var file = '人大代表名单及信息.csv';
var lines = fs.readFileSync(file, {encoding: 'utf8'}).split('\r');
// console.log(lines);
var people = [];
var names = '';
for(var i = 1; i < lines.length; i ++) {
  console.log(lines[i]);
  var p = {};
  var fields = lines[i].split(',');
  p.fullname = fields[0];
  names = names + p.fullname + '|0x0080|101\n';
  p.gender = fields[1];
  p.nation = fields[2];
  p.birthdate = fields[3];
  var birthyear = p.birthdate.substring(0, 4);
  p.age = 2017 - parseInt(birthyear);
  p.birthplace = fields[4];
  p.title = fields[5];
  p.party = fields[6];
  p.delegation = fields[7];
  p.education = fields[8];
  p.degree = fields[9];
  p.college = fields[10];
  p.major = fields[11];
  p.npc = 1;
  people.push(p);
}
fs.writeFileSync('npc.js', json.stringify(people), {encoding: 'utf8'});
fs.writeFileSync('names.txt', names, {encoding: 'utf8'})
