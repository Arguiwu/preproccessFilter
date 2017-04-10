var http = require('http');
var preproccess = require('../index.js');

http.createServer(function(req,res) {
	res.writeHead(200, {
		'Content-Type': 'text/html; charset=utf-8'
	});
	var content = preproccess.render('/', {
		header: 'header content',
		content: 'content',
		dataList: [
			{
				id:1,
				content: 1
			},
			{
				id:2,
				content: 2
			},
			{
				id:3,
				content: 3
			}
		]
	});

	res.end(content);

}).listen(3456, function() {
	console.log("Server running at 3456 port");
});