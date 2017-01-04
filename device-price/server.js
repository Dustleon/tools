var http = require("http"),
	url = require("url"),
	charset = require('superagent-charset'),
 	superagent = require("superagent"),
 	cheerio = require("cheerio"),
 	Promise = require('promise'),
 	iconv = require("iconv-lite");

var USER_AGENT = "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36",
	SEARCH_PREFIX_URL = "http://search.zol.com.cn/s/all.php?kword=";

var DATA = require("./data/input-deviceType.js"),
	keywords = [],
	result = {};


charset(superagent);


let pad = function (number, length, pos) {
	var str = "%" + number;
	while (str.length < length) {
		//向右边补0
		if ("r" == pos) {
			str = str + "0";
		} else {
			str = "0" + str;
		}
	}
	return str;
}

let toHex = function (chr, padLen) {
	if (null == padLen) {
		padLen = 2;
	}
	return pad(chr.toString(16), padLen);
}

let str2gbk = function(data) {
	var gbk = iconv.encode(data.toString('UCS2'), 'gbk');
	var gbkHex = "";
	for (var i = 0; i < gbk.length; ++i) {
		gbkHex += toHex(gbk[i]);
	}
	return gbkHex.toUpperCase();
}


/**
 * Main Entry
 */
function start() {

	function prepare() {
		if (DATA["deviceType"] && DATA["deviceType"].length > 0) {
			DATA["deviceType"].forEach(function(brand) {
				if (brand) {
					var brandName = brand["text"],
						brandDevices = brand["list"];

					if (brandDevices) {
						for (deviceName in brandDevices) {
							keywords.push(brandName + " " + brandDevices[deviceName]);
						}
					}
				}
			});
		}
	}

	function fetch(keyword) {
		// 转码
		keyword = str2gbk(keyword);

		var promise = new Promise(function(resolve, reject) {
			superagent.get(SEARCH_PREFIX_URL + keyword)
				.charset("gbk") 
				.set("User-Agent", USER_AGENT)
				.end(function(err, sres) {
					// 常规的错误处理
					if (err) {
						reject(err);
					} else {
						// sres.text 里面存储着请求返回的 html 内容
						resolve(sres.text);
					}
				});
		});

		return promise;
	}

	function process(index, res) {
		var delay = parseInt((Math.random() * 30000000) % 1000, 10);

		res.write("正在抓取：" + keywords[index] + "<br/>");
		fetch(keywords[index]).then(function(html) {
			var $ = cheerio.load(html);

			var priceTxt = $(".search-result-list .result-for-aladdin .product-summary .param-table tr").first().find("td em").text();
			// debug
			res.write("FETCH " + keywords[index] + " SUCCESSFUL, RESULT: " + priceTxt + "<br/>");
			
			result[keywords[index]] = priceTxt;
		}, function(err) {
			result[keywords[index]] = "";
			console.log(err);
		}).then(function() {
			index ++;
			if (index < keywords.length) {
				setTimeout(function() {
					process(index, res);
				}, delay);
			} else {
				final(res);
			}
		});
	}

	function final(res) {
		if (DATA["deviceType"] && DATA["deviceType"].length > 0) {
			DATA["deviceType"].forEach(function(brand) {
				if (brand) {
					var brandName = brand["text"],
						brandDevices = brand["list"];

					if (brandDevices) {
						for (deviceName in brandDevices) {
							brandDevices[deviceName] = result[brandName + " " + brandDevices[deviceName]];
						}
					}
				}
			});
		}

		res.write("最终结果：<br/>");
		res.write(JSON.stringify(DATA));
		res.end();
	}

	function onRequest(req, res) {
		res.writeHead(200, { "Content-Type": "text/html;charset=utf-8" });

		prepare();
		process(0, res);
	}

	http.createServer(onRequest).listen(3000);
}

exports.start = start;
