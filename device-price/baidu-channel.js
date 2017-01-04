var fs = require("fs"),
	http = require("http"),
	url = require("url"),
	charset = require('superagent-charset'),
 	superagent = require("superagent"),
 	cheerio = require("cheerio"),
 	Promise = require('promise');

var USER_AGENT = "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36",
	SEARCH_PREFIX_URL = "https://www.baidu.com/s?wd=site%3Adetail.zol.com.cn%20",
	INPUT_FILE = "./data/input-deviceType2.js",
	OUTPUT_FILE = "./data/result2.js";

var DATA = require(INPUT_FILE),
	keywords = [],
	result = {};


charset(superagent);

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

	function fetch(url, charset) {
		var promise = new Promise(function(resolve, reject) {
			superagent.get(url)
				.charset(charset)
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
		res.write("正在抓取：" + keywords[index] + "<br/>");
		res.write("正在请求：" + SEARCH_PREFIX_URL + keywords[index] + "<br/>");
		// 百度搜索
		fetch(SEARCH_PREFIX_URL + encodeURIComponent(keywords[index])).then(function(html) {
			// 获取第一条搜索结果
			var $ = cheerio.load(html);

			var url = $("#1 .t > a").attr("href");
			// debug
			res.write("FETCH " + keywords[index] + " URL: " + url + "<br/>");

			// 抓取价格
			fetch(url, 'gbk').then(function(html) {
				var $ = cheerio.load(html);

				var priceTxt = $(".product-detail-main .price .price-type").text();
				// debug
				res.write("FETCH " + keywords[index] + " SUCCESSFUL, RESULT: " + priceTxt + "<br/>");

				result[keywords[index]] = priceTxt;
			}, function(err) {
				result[keywords[index]] = "";
				console.log(err);
			}).then(function() {
				next(index, res);
			});
		}, function(err) {
			result[keywords[index]] = "";
			console.log(err);

			next(index, res);
		});
	}

	function next(index, res) {
		var delay = parseInt((Math.random() * 30000000) % 1000, 10);
		index ++;
		if (index < keywords.length) {
			setTimeout(function() {
				process(index, res);
			}, delay);
		} else {
			final(res);
		}
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

		var dataJSONStr = JSON.stringify(DATA);
		res.write("最终结果：<br/>");
		res.write(dataJSONStr);

		// 将抓取结果写入文件中
		res.write("准备写入文件...<br/>")
		fs.writeFile(OUTPUT_FILE, dataJSONStr, function(err) {
		    if (err) {
		      res.write("写入错误：", JSON.stringify(err));
					res.end();
					return;
		    }

				res.write("数据写入成功！！！<br/>");
				res.end();
		});
	}

	function onRequest(req, res) {
		res.writeHead(200, { "Content-Type": "text/html;charset=utf-8" });

		prepare();
		process(0, res);
	}

	http.createServer(onRequest).listen(3000);
}

exports.start = start;
