var request = require("request");
var cheerio = require("cheerio");
var fs = require("fs");

var output = {};

loadListPages(["right", "left"]);

function loadListPages(listPages, index = 0, output = []) {
	const listPage = listPages[index]

	request("https://mediabiasfactcheck.com/" + listPage, function(error, response, indexBody) {
		if(error){
			console.log("Error when loading the list pages!");
			throw error;
		}
		var $ = cheerio.load(indexBody);

		$(".entry.clearfix > p a[href*=\"mediabiasfactcheck.com\"]").each(function() {
			const linkName = $(this).attr("href");
			const siteName = /mediabiasfactcheck\.com\/([A-Za-z0-9\-]+)\//.exec(linkName)[1].replace(/\-/g, " ");

			output.push({
				name: siteName,
				link: linkName,
				leaning: listPage,
				poll: {}
			});
		});

		if(index + 1 === listPages.length) {
			loadSitePages(output);
		} else {
			loadListPages(listPages, index + 1, output);
		}
	});
}

function loadSitePages(output, index = 0) {
	var siteData = output[index];

	request(siteData.link, function(error, response, siteBody) {
		if(error) {
			console.log(`Error while loading site: "${siteData.link}"`);
			console.log(error);
		}

		const percentJump = 5;
		if(
			Math.floor(100 * (index + 1) / (output.length * percentJump))
			> Math.floor(100 * index / (output.length * percentJump))
		) {
			const percent = Math.floor(100 * (index + 1) / (output.length * percentJump)) * percentJump;
			console.log(`${percent}% (${index + 1}/${output.length})`);
		}

		var $ = cheerio.load(siteBody);

		var script = $("script[src*=\"polldaddy\"]");
		var siteIndex = /\/p\/([0-9]+)\.js/.exec(script.attr("src"))[1];
		var factualReporting = $(".entry-content > p > span > strong").text().replace(/\s/g, "");

		siteData.id = siteIndex;
		siteData.rating = factualReporting;

		request(`https://polls.polldaddy.com/vote-js.php?p=${siteIndex}`, function(error, response, pollBody) {
			if(error) {
				console.log(`Error while loading poll for site: "${siteData.link}"`);
				console.log(error);
			}
			var $ = cheerio.load(/innerHTML='(.+)'/.exec(pollBody)[1]);

			$(".pds-feedback-label").each(function(index) {
				const numberRegex = /([0-9]+(?:\.[0-9]+)?)/;

				var option = $(this).find(".pds-answer-text").text().replace(/\s/g, "");
				var percentText = $(this).find(".pds-feedback-per").text();
				var percent = numberRegex.exec(percentText)[1];
				var votesText = $(this).find(".pds-feedback-votes").text();
				var votes = numberRegex.exec(votesText)[1];

				siteData.poll[option] = {
					percent: parseFloat(percent),
					votes: parseInt(votes),
				}
			});

			if(index + 1 === output.length) {
				writeOutput(output);
			} else {
				loadSitePages(output, index + 1);
			}
		});
	})
}

function writeOutput(output) {
	fs.writeFile("output.json", myFancyStringify(output), function(error) {
		if(error) console.log(error);

		console.log("Finished outputting!");
	})
}

function myFancyStringify(val, indent = "", prefix = "") {
	var ret = indent + prefix;

	switch(typeof val) {
	case "undefined":
		ret += "null";
		break;
	case "boolean": case "number":
		ret += val;
		break;
	case "string":
		ret += `"${val}"`;
		break;
	case "object":
		if(val === null) {
			ret += "null";
		} else if(Array.isArray(val)) {
			ret += "[\r\n";
			val.forEach((child, i) => {
				ret += myFancyStringify(child, indent + "\t");

				if(i < val.length - 1) ret += ",";

				ret += "\r\n";
			});
			ret += `${indent}]`;
		} else {
			ret += "{";

			for(var i in val) {
				if(!ret.endsWith("{")) ret += ",";
				ret += "\r\n";

				ret += myFancyStringify(val[i], indent + "\t", `"${i}": `);
			}
			ret += `\r\n${indent}}`
		}
		break;
	}
	return ret;
}