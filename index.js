var fs = require("fs");
var path = require('path');
var preproccess = {
	PAGE_DIR: './test/page/',
	render: function(filePath, mockData) {
		return processHTML(filePath, mockData);
	}
};

// 读取 include 文件地址 
function parseInclude(fileDir, commandIncludePath, mockData) {
	var commonContent = '';

	if(commandIncludePath) {
		var fileIncludePath = path.join(preproccess.PAGE_DIR, fileDir, commandIncludePath);

		if(fs.existsSync(fileIncludePath)) {
			var contentBuffer = fs.readFileSync(fileIncludePath);
			var fileHeadCode = contentBuffer[0].toString(16) + contentBuffer[1].toString(16) + contentBuffer[2].toString();
			var contentBufferBegin = 0;
			if(fileHeadCode.toLowerCase() === 'efbbbf') {
				contentBufferBegin = 3;
			}
			commonContent = contentBuffer.toString('utf8',contentBufferBegin);
		}
	}else {
		var logFilePath = path.resolve(fileIncludePath);
		console.log(`错误，文件路径：${logFilePath} 无法找到`);
	}
	return parseCommandViaBuildInTag(commonContent, fileIncludePath, mockData);
};

// 获取页面自定义 指令字段 并插入数据
function getField(field, pageFieldData) {
	var fieldValue = pageFieldData[field];
	if(fieldValue === undefined) {
		console.log(`页面field变量：${field} 没有数据，使用空字符代替`);
	}
	return (fieldValue !== undefined) ? fieldValue : '';
};

// 解析 `include` `field` 指令
function parseCommandViaBuildInTag(content, fileContentPath, mockData) {
	var pathObject = path.parse(fileContentPath);
	var fileDir = pathObject.dir;

	var buildInTagReg = /\{vinson\:.*?\/\}/g;
	var includeReg = /include=\"(.+)\"/;
	var fieldReg = /field\.(.+?)\s?\/\}/;
	var parsedContent = content.replace(buildInTagReg, function(commandString) {
		var replaceValue = commandString;
		var matchResult = null;

		if(matchResult = commandString.match(includeReg)) {
			replaceValue = parseInclude(fileDir, matchResult[1], mockData);
		}else if(matchResult = commandString.match(fieldReg)) {
			replaceValue = getField(matchResult[1], mockData);
		}else {
			replaceValue = '';
		}
		return replaceValue;
	});
	return parsedContent;
};

// 解析 if指令
function parseCommandViaIf(content, mockData) {
	var ifTagReg = /\{if[\s\S]+?\{end\sif\}/g;
	var parsedContent = content.replace(ifTagReg, function(tagString) {
		var returnContent = null;
		var ifExpressionReg = /\{if\s+\"(.*?)\"(.+)\"(.*?)\"\s+then\}/;
		var ifExpression = tagString.match(ifExpressionReg);
		var compareLeftValue = ifExpression[1];
		var compareRelation = ifExpression[2].trim();
		var compareRightValue = ifExpression[3];
		var isCompareTrue = false;
		var hasElesBlock = true;

		if(tagString.indexOf('{else}') == -1) {
			hasElesBlock = false;
		}

		if((compareRelation == '=') && (compareLeftValue == compareRightValue)) {
			isCompareTrue = true;
		}else if((compareRelation == '<>') && (compareLeftValue != compareRightValue)) {
			isCompareTrue = true;
		}
		if(!isCompareTrue && !hasElesBlock) {
			return '';
		}

		var ifBlockContentWithElseReg = /\{if.*then\}([\s\S]+)\{else\}/;
		var ifBlockContentWithoutElseReg = /\{if.*then\}([\s\S]+)\{end if\}/;
		var elseBlockContentWithElseReg = /\{else\}([\s\S]+){end if}/;
		var returnContentReg = null;

		if(isCompareTrue) {
			if(hasElesBlock) {
				returnContentReg = ifBlockContentWithElseReg;
			}else {
				returnContentReg = ifBlockContentWithoutElseReg;
			}
		}else {
			returnContentReg = elseBlockContentWithElseReg;
		}
		returnContent = (tagString.match(returnContentReg) || [])[1];
		return returnContent || '';
	});
	return parsedContent;
};

// 解析for循环指令
function parseCommandViaTable(content, mockData) {
	var customTagReg = null;
	var customTagNameReg = /\{\/vinson\:(.+)\}/;
	var customTagVarNameReg = /parser=\"(.+?)\"/;
	var customTagPropNameReg = /from=\"(.*?)\"/;
	var customTagContentReg = /\{vinson\:.+\}([\s\S]+)\{\/vinson\:.+\}/;

	var _replaceTag = function(tagString, customTagName) {
		customTagName = customTagName || tagString.match(customTagNameReg)[1];
		var customTagVarName = tagString.match(customTagVarNameReg)[1];
		var customTagPropName = (tagString.match(customTagPropNameReg) || [])[1];

		var customTagData = mockData[customTagVarName];
		if(!customTagData) {
			return '';
		}

		var dataList = customTagData[customTagPropName] || customTagData;
		if(!Array.isArray(dataList) || !dataList.length) {
			return '';
		}

		var customTagContent = tagString.match(customTagContentReg)[1].trim();
		var customTagCommandReg = /\[.+?\:.+?\s+\/\]/g;
		var customTagPropReg = /\[(.+)\:(.+)\s+/;

		var returnContent = dataList.map(function(dataItem) {
			return customTagContent.replace(customTagCommandReg, function(propString) {
				var matchValue = propString.match(customTagPropReg) || [];
				var propbelongsTagName = matchValue[1];
				if(propbelongsTagName != customTagName) {
					return propString;
				}

				var propName = matchValue[2];
				var propValue = dataItem[propName];

				return (propValue !== undefined) ? propValue : '';
			});
		});
		return returnContent.join('\r\n');
	};
	var parsedContent = content;
	var customTagStartReg = /\{vinson\:(.*?)\s+.*\}/;
	var matchValue = null;
	var i = 20;
	while(i--) {
		matchValue = parsedContent.match(customTagStartReg);
		if(!matchValue) {
			break;
		}
		var tagName = matchValue[1];
		if(!tagName) {
			break;
		}
		customTagReg = new RegExp('{vinson:' + tagName + '.*}([\\s\\S]+?){/vinson:' + tagName + '}', 'g');
		parsedContent = parsedContent.replace(customTagReg, function (tagString) {
			return _replaceTag(tagString, tagName);
		});
	}
	return parsedContent;
}

// 解析指令
function parseCommand(content, fileContentPath, mockData) {
	var parsedContent = null;
	parsedContent = parseCommandViaBuildInTag(content, fileContentPath, mockData);
	parsedContent = parseCommandViaTable(parsedContent, mockData);
	parsedContent = parseCommandViaIf(parsedContent, mockData);
	return parsedContent;
}
//  读取html文件
function processHTML(filePath, mockData) {
	var pathObject = path.parse(filePath);
	var fileDir = pathObject.ext ? pathObject.dir : filePath;
	var fileName = pathObject.ext ? pathObject.name : 'index';
	var fileFullName = fileName + (pathObject.ext || '.html');
	var fileContentPath = path.join(fileDir, fileFullName);
	// TODO: 对不存在的文件进行友好提示（替换默认的404页面）

	var fileContent = fs.readFileSync(path.join(preproccess.PAGE_DIR, fileContentPath), 'utf8');
	var outputContent = parseCommand(fileContent, fileContentPath, mockData);
	return outputContent;
};


module.exports = preproccess;